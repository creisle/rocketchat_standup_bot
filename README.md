# Hubot-Rocketchat StandUp Bot

This was built from https://github.com/RocketChat/hubot-rocketchat-boilerplate

- [Using the Bot](#using-the-bot)
  - [Create a StandUp](#create-a-standup)
    - [Adding Members](#adding-members)
    - [Scheduling the Reminder](#scheduling-the-reminder)
- [Install Instructions (Developers)](#install-instructions-developers)
  - [Running Locally](#running-locally)
- [Configuration](#configuration)

## Using the Bot

This bot adds up to 1 standup per chat room. If you want to use it with a private room you will
need to add the bot user to the room.

### Create a StandUp

In the room you want to run stand up from

```
bot show
```

This will show you the details of the current stanup in this room. If no one has joined the stand up
and it has not been scheduled it will look something like this

```
Current Standup Settings

Members:

Currently not scheduled
```

#### Adding Members

To join the stanup, each user must run the following in the room

```
bot join
```

They should see a reply like the following

```
Added USERNAME to the list of standup members
```

You can see the list of members joined by running the `bot show` command

#### Scheduling the Reminder

Stand up can be initiated manually from the room it is set in with

```
bot init
```

but it can also be scheduled to automate this process

```
bot sched
```

This will ask the user for days of the week and a time to run at. It will use
these to set the cron-job reminder

## Install Instructions (Developers)

```
git clone https://svn.bcgsc.ca/bitbucket/scm/dat/rocketchat_standup_bot.git
cd hubot-rocketchat-boilerplate
npm install
```
Create a _.env_ file with content:

```
export ROCKETCHAT_URL=myserver.com
export ROCKETCHAT_USER=mybotuser
export ROCKETCHAT_PASSWORD=mypassword
export ROCKETCHAT_ROOM=general
export ROCKETCHAT_USESSL=false
export RESPOND_TO_DM=true
export HUBOT_ADAPTER=rocketchat
export HUBOT_ALIAS=bot
```

Adjust the content to fit your server and user credentials. Make sure `myuser` has **BOT role** on the server, if you don't know what that means, ask your server administrator to set it up for you.

Then run the bot:

```
npm start
```

On the server, login as a regular user (not the BOT user), go to GENERAL, and try:

```
bot help
```

Which will show you the available commands


### Running Locally

You can run with the shell adapter just to test

1. Run `yarn` or `npm install` to install dependencies
2. Use the `yarn shell` script to start the bot with shell adaptor
3. Say `hubot help` to see what it can do

When you're ready to connect the bot to an instance of Rocket.Chat

1. Create a user for the bot, with the role _bot_
2. Create an `./.env` file with the user and connection settings
3. Run `yarn local` script to connect to your local Rocket.Chat

The `local` npm script will read in the env file, so you can populate and modify
those settings easily (see [configuration](#configuration)). In production, they
should be pre-populated in the server environment.


## Configuration

When running locally, we've used [`dotenv`][dotenv] to load configs from the
`./.env` file. That makes it easy for setting environment variables.

Please see [adapter docs for source of truth on environment variables][env].
