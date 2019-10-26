// Description:
//    An example script, tells you the time. See below on how documentation works.
//    https://github.com/hubotio/hubot/blob/master/docs/scripting.md#documenting-scripts
//
// Commands:
//    bot what time is it? - Tells you the time
//    bot what's the time? - Tells you the time
//
const Conversation = require('hubot-conversation');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');


const BRAIN_FILE = path.join(process.env.FILE_BRAIN_PATH || '.', 'brain-dump.json');

const newStandUp = () => {
    return {members: {}, schedule: null, time: null};
};


const generateStandUpKey = (msg) => {
    return `standup-${msg.envelope.user.roomID}`;
};


const setUserStandUp = (robot, roomId, userId, content, upsert=true) => {
    let standup = robot.brain.get(`standup-${roomId}-${userId}`) || {};
    if (upsert) {
        standup = {...standup, ...content};
    } else {
        standup = content;
    }
    robot.brain.set(`standup-${roomId}-${userId}`, standup);
};

const getUserStandUp = (robot, roomId, userId) => {
    return robot.brain.get(`standup-${roomId}-${userId}`);
};

const addUserToStandUp = (robot, roomId, userId, username) => {
    const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
    standup.members[userId] = username;
    robot.brain.set(`standup-${roomId}`, standup);
};

const removeUserFromStandUp = (robot, roomId, userId) => {
    const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
    delete standup.members[userId];
    robot.brain.set(`standup-${roomId}`, standup);
};


const standUpConversation = (robot, standUpRoomId, userId, username) => {

    const dmRoomId = [robot.adapter.userId, userId].sort().join(''); // getPrivateConvoRoom(robot, userId);

    const getToday = (msg, dialog) => {
        msg.reply(`${username}, What will you do today?`);
        dialog.addChoice(/.*/i, (msgToday) => {
            setUserStandUp(robot, standUpRoomId, userId, {today: msgToday.message.text.replace(/^Hubot\s+/, '')});

            msgToday.reply(`${username}, Any blockers?`);
            dialog.addChoice(/.*/i, (msgBlockers) => {
                setUserStandUp(robot, standUpRoomId, userId, {blockers: msgBlockers.message.text.replace(/^Hubot\s+/, '')});

                const content = getUserStandUp(robot, standUpRoomId, userId);

                robot.send(
                    {room: standUpRoomId, user: {id: userId, roomID: standUpRoomId}},
                    `#### Stand Up: ${username}
**yday**
${content.yday}

**today**
${content.today}

**blockers**
${content.blockers}
`)
            })
        });
    };

    const getYday = (msg, dialog) => {
        const fakeTarget = {room: dmRoomId, user: {roomID: dmRoomId, id: userId}};
        robot.send(fakeTarget, `${username}, What did you do yesterday?`);
        dialog.addChoice(/.*/i, function (resp) {
            if (resp.envelope.user.roomID !== dmRoomId) {
                console.error('\nuser sent non-direct message', resp.envelope.user.roomID, resp.envelope.user.name)
                getYday(msg, dialog);
            } else {
                setUserStandUp(robot, standUpRoomId, userId, {yday: resp.message.text.replace(/^Hubot\s+/, '')});
                getToday(resp, dialog);
            }
        });
    };

    const fakeTarget = {room: dmRoomId, user: {roomID: dmRoomId, id: userId}};
    const fakeMessage = {
        message: fakeTarget,
        envelope: fakeTarget,
        reply: content => robot.send(fakeTarget, content)
    };
    const dialog = robot.switchBoard.startDialog(fakeMessage, 10 * 60 * 1000);  // 10m
    const standup = robot.brain.get(`standup-${standUpRoomId}`);

    setUserStandUp(robot, standUpRoomId, userId, {}, false);

    getYday(fakeTarget, dialog);
};


const cancelStandUp = (robot, roomId) => {
    const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
    if (standup.schedule) {
        standup.schedule.cancel();
        standup.schedule = null;
        standup.time = null;
    }
    robot.brain.set(`standup-${roomId}`, standup);
};

const pingStandUp = (robot, roomId) => () => {
    robot.adapter.send({room: roomId, user: {}}, 'Waiting for members to complete standup....');
    // get the members of the standup

    const standup = robot.brain.get(`standup-${roomId}`);
    // ping each user to complete their stand up

    for (const memberId of Object.keys(standup.members || {})) {
        const username = standup.members[memberId]
        standUpConversation(robot, roomId, memberId, username);
    }
};


/**
 * Save the current robot brain to a file
 */
const save = (data) => {
    console.log(`writing brain to file (${BRAIN_FILE})`);
    const sanitary = {};
    for (const key of Object.keys(data)) {
        if (!key.toLowerCase().includes('password')) {
            sanitary[key] = data[key];
        }
    }
    fs.writeFileSync(BRAIN_FILE, JSON.stringify(data, null, 2));
};


const setStandUpSchedule = (robot, roomId, cronstamp) => {
    const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();

    if (standup.schedule) {
        standup.schedule.cancel();
    }

    standup.schedule = schedule.scheduleJob(cronstamp, pingStandUp(robot, roomId));
    standup.time = cronstamp;
    robot.brain.set(`standup-${roomId}`, standup);
};


/**
 * Ask the User for Information to be able to set when standup should ping users
 */
const scheduleStandUp =  robot => (msg) => {

    const {roomID: roomId} = msg.envelope.user;
    const dialog = robot.switchBoard.startDialog(msg);

    msg.reply('What days of the week should this run for (MWTRF)?');
    dialog.addChoice(/^[MWTRF]+$/i, (msg2) => {
        const {message: {text: weekdays}} = msg2;
        const crondays = [];
        for (const day of weekdays.toUpperCase().replace(/[\s,]+/g, '')) {
            const index = 'MWTRF'.indexOf(day) + 1;
            crondays.push(index);
            if (index < 1) {
                return msg2.reply(`BAD INPUT (${day})`);
            }
        }

        msg2.reply('What time should this run at (HH:mm)?');
        dialog.addChoice(/^[01][0-9]:[0-5][0-9]$/i, (msg3) => {
            const {message: {text: time}} = msg3;
            const [hour, min] = time.split(':');
            let cronstamp = `0 ${min} ${hour} * * ${crondays.sort().join(',')}`;

            // set the standup in the key value store
            setStandUpSchedule(robot, roomId, cronstamp);

            // notify the user
            msg3.reply(`Standup scheduled at \`${cronstamp}\``);
        });
    });
};



module.exports = function (robot) {
    // load the brain from the JSON file
    console.log(`reading brain from file (${BRAIN_FILE})`);
    const brain = JSON.parse(fs.readFileSync(BRAIN_FILE));

    // restart the crons
    for (const [key, data] of Object.entries(brain._private)) {
        if (key.startsWith('standup-') && data.time) {
            const roomId = key.slice('standup-'.length);
            console.log(`scheduling standup ${key} at ${data.time}`);
            data.schedule = schedule.scheduleJob(data.time, pingStandUp(robot, roomId));
        }
    }

    robot.brain.mergeData(brain);

    robot.brain.on('save', save)
    robot.switchBoard = new Conversation(robot);
    const robotUserId = robot.adapter.userId;

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

    robot.respond(/sched(ule)?/i, scheduleStandUp(robot));

    robot.respond(/start/i, (msg) => {
        // manually trigger a standup without scheduling
        const {roomID} = msg.envelope.user;
        const standup = robot.brain.get(`standup-${roomId}`) || newStandUp();
    })

    robot.respond(/join/i, (msg) => {
        // add user to the standup for this room
        const {id: userId, roomID, name: username, roomType} = msg.envelope.user;

        addUserToStandUp(robot, roomID, userId, username);
        msg.reply(`Added ${username} to the list of standup members`);
    });

    robot.respond(/leave/i, (msg) => {
        // remove current user from this standup
        const {id: userId, roomID, name} = msg.envelope.user;
        removeUserFromStandUp(robot, roomID, userId);
        msg.reply(`Removed ${name} from the list of standup members`);
    });

    robot.respond(/cancel/i, (msg) => {
        const {id: userId, roomID} = msg.envelope.user;
        cancelStandUp(robot, roomID);
        msg.reply('Cancelled the current standup');
    });

    robot.respond(/get room id/i, (msg) => {
        const {id: userId, roomID} = msg.envelope.user;
        msg.reply(`The current room Id is ${roomID}`);
    });


    robot.respond(/help/i, (msg) => {
        // show all available commands
        let menu = `Available Commands:
\`<bot> join\` add your user to the standup in the current room
\`<bot> leave\` remove your user from the standup in the current room
\`<bot> show\` list the users registered for standup in this room
\`<bot> schedule\` set the reminder for when to ping users to enter their standup information
\`<bot> cancel\` removes the current standup reminder
\`<bot> init\` manually initiate a standup (will ping standup members individually)`;
        msg.reply(menu);
    })

    robot.respond(/(init|initiate)/i, (msg) => {
        pingStandUp(robot, msg.envelope.user.roomID)();
    });

};
