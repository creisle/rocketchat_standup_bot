module.exports = function (robot) {

    const switchBoard = new Conversation(robot);
    const robotUserId = robot.adapter.userId;

    const robotDmRoomId = (msg) => {
        return `${msg.envelope.user.id}${robotUserId}`;  // rocketchat concatenates users to create private message rooms
    };

    const newStandUp = () => {
        return {members: {}, schedule: null, time: null};
    }

    // const userSettingsKey = (msg) => {
    //     return `user-settings-${msg.envelope.user.id}`;
    // };

    // const upsertUserSetting = (msg, setting, value) => {
    //     const settings = (robot.brain.get(userSettingsKey(msg)) || {});
    //     robot.brain.set(userSettingsKey(msg), {...settings, [setting]: value});
    // };

    const askForUserStandup = (standUpRoomId, userId) => {
        const dialog = switchBoard.startDialog(robot);
        const standup = robot.brain.get(`standup-${standUpRoomId}`)
        setUserStandup(standUpRoomId, userId, {}, false);

        robot.reply('What did you do yesterday?');
        dialog.addChoice(/.*/i, function (msgYday) {
            setUserStandup(standUpRoomId, userId, {yday: msgYday.message.text});

            msgYday.reply('What will you do today?');
            dialog.addChoice(/.*/i, (msgToday) => {
                setUserStandup(standUpRoomId, userId, {today: msgToday.message.text});

                msgToday.reply('Any blockers?');
                dialog.addChoice(/.*/i, (msgBlockers) => {
                    setUserStandup(standUpRoomId, userId, {blockers: msgBlockers.message.text});

                    const content = robot.brain.get(key);
                    if (standupTarget) {
                        msgBlockers.envelope.user.roomID = standUpRoomId;  // reply to the stored preferred response room
                    }
                    msgBlockers.send(`#### Stand Up: ${username}
**yday**
${content.yday.replace(/^Hubot\s+/, '')}

**today**
${content.today.replace(/^Hubot\s+/, '')}

**blockers**
${content.blockers.replace(/^Hubot\s+/, '')}
`)
                })
            })
        });
    }

    const setUserStandup = (roomId, userId, content, upsert=true) => {
        let standup = robot.brain.get(`standup-${roomId}-${userId}`) || {};
        if (upsert) {
            standup = {...standup, ...content};
        } else {
            standup = content;
        }
        robot.brain.set(`standup-${roomId}-${userId}`, standup);
    };

    const addUserToStandUp = (roomId, userId, username) => {
        const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
        standup.members[userId] = username;
        robot.brain.set(`standup-${roomId}`, standup);
    };

    const removeUserFromStandUp = (roomId, userId) => {
        const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
        delete standup.members[userId];
        robot.brain.set(`standup-${roomId}`, standup);
    };

    const scheduleStandUp = (roomId, cronstamp) => {
        const s = schedule.scheduleJob(cronstamp, pingStandUp(roomId));
        const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
        standup.schedule = s;
        standup.time = cronstamp;
        robot.brain.set(`standup-${roomId}`, standup);
    };

    const cancelStandUp = (roomId) => {
        const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
        if (standup.schedule) {
            standup.schedule.cancel();
            standup.schedule = null;
            standup.time = null;
        }
    };

    const pingStandUp = roomId => () => {
        robot.send(roomID, 'ping for standup');
    };

    robot.respond(/show/i, (msg) => {
        const {roomID} = msg.envelope.user;
        const standup = robot.brain.get(`standup-${roomID}`) || newStandUp()
        let reply = '**Current Standup Settings**\n\nMembers:';
        for (const username of Object.values(standup.members || {})) {
            reply = `${reply}\n- ${username}`;
        }
        if (standup.time) {
            reply = `${reply}\n\nScheduled at \`${standup.time}\``;
        } else {
            reply = `${reply}\n\nCurrently not scheduled`;
        }
        msg.reply(reply);
    });

    robot.respond(/cancel/i, (msg) => {
        const {roomID} = msg.envelope.user;
        cancelStandUp(roomID);
        msg.reply('Cancelled all schedules for this standup');
    })

    robot.respond(/sched(ule)?/i, (msg) => {
        const {roomID} = msg.envelope.user;
        const dialog = switchBoard.startDialog(msg);

        msg.reply('What days of the week should this run for (MWTRF)?');
        dialog.addChoice(/^[MWTRF]+$/i, (msg2) => {
            const {message: {text: weekdays}} = msg2;
            const crondays = [];
            for (const day of weekdays) {
                crondays.push('MWTRF'.indexOf(day) + 1);
            }

            msg2.reply('What time should this run at (HH:mm)?');
            dialog.addChoice(/^[01][0-9]:[0-5][0-9]$/i, (msg3) => {
                const {message: {text: time}} = msg3;
                const [hour, min] = time.split(':');
                let cronstamp = `* ${min} ${hour} * * ${crondays.sort().join(',')}`;
                scheduleStandUp(roomID, cronstamp);
                msg3.reply(`Standup scheduled at \`${cronstamp}\``);
            });
        });

    })

    robot.respond(/set jira password/i, (msg) => {
        // manually trigger a standup without scheduling
        const {roomID} = msg.envelope.user;
        const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
    });

};
