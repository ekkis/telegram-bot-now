[![npm version](https://badge.fury.io/js/telegram-bot-now.svg)](https://badge.fury.io/js/telegram-bot-now)

# Telegram Bot Now 

This project offers a skeleton for easily creating Telegram bots using the Now 
serverless platform.  For more information on Now, see:

https://zeit.co/now

## Install

The project is available from NPM and can be installed in the usual way:
```bash
$ npm install --save telegram-bot-now
```
But to deploy your bot you'll also need the Now client.  Install it like this:
```bash
$ npm install -g now
```

## Scaffolding

When the package is installed, it creates a symlink to our maker utility.  You can
thus grab our skeleton code like this:
```bash
$ ./mk scaffold
```
The main entry point for your server is named `server.js` so if your current `package.json`
is using `index.js` you may want to change the line below (or rename the file, but if you do
that don't forget to also change the `now.json`):
```json
  "main": "server.js",
```
Additionally, you may want to have the following as well:
```json
"scripts": {
    "start": "micro",
    "dev": "micro-dev",
    "debug": "node --inspect node_modules/.bin/micro-dev"
},
```
which will allow you to start your server locally (use `npm run dev` in development
so use the `micro-dev` engine), and if you use Microsoft VS Code, you can create a debug
configuration (in your `.vscode/launch.json`) like this, to allow debugging:
```json
{
    "type": "node",
    "request": "launch",
    "name": "Launch via NPM",
    "runtimeExecutable": "npm",
    "runtimeArgs": [
        "run-script",
        "debug"
    ],
    "port": 9229,
    "envFile": "${workspaceFolder}/.env"
}
```
Finally, if for whatever reason the symlink to `mk` was not properly created, you can create
it by hand like this:
```bash
ln -s node_modules/telegram-bot-now/mk
```
> Please note: the make utility will not work on Windows.  Users of that operating
> system are encouraged to install Cygwin or another bash shell available

## Configure

Before deploying your bot you'll first need to edit your environment file `.env` with the
needed information.  The TELEGRAM_BOT_KEY is the value the Bot Father gives you for your
bot, and the _URL will be your Now deployment alias.  You'll need to create an account
on Now first (the account name is included in the url) and the project name is the name
of the directory where your project resides

Once you've entered in the right values run the command below:
```bash
$ ./mk secrets
```
which will upload the secrets to the Now environment.  If you need to run your bot locally
(for debugging), you can:
```bash
$ npm install --save-dev micro-dev # in case you don't have it installed
$ eval "$(./mk env)"
$ npm run dev
```
Your environment file is also compatible with the Microsoft VS Code debugger.  Just make sure
your `.vscode/launch.json` file contains the following line (as previously shown):
```json
    "envFile": "${workspaceFolder}/.env"
```

## Deploy

Finally, you can create a Now deployment very simply:
```bash
$ ./mk
```
The above will synchronise the local files in your project with the Now servers and 
the bot will automatically bind the Telegram *webhook* to the TELEGRAM_BOT_URL deployment
address in your environment file.

To see logs on the deployment:
```bash
$ ./mk logs
```
To see other commands supported by the make utility:
```bash
$ ./mk --help
```

## Test

Before you can take your new bot for a spin, you need to get it started.  Run this:
```bash
$ ./mk msg -b "/start"
```
Then go to Telegram, find the bot and start chatting! If you used our scaffolding you
can greet the bot:
```
/hello
```
and it should greet you back

## Additional Reading

For a complete description of how to set up routes, create dialogues, the various utilities provided
in the module, and troubleshooting guidance, please read the Medium article:

[A Telegram bot in the serverless Now](https://medium.com/@ekkis/building-a-telegram-bot-in-node-js-now-6daea82ca425)

## Contribute

If there's some enhancement you'd like to contribute, please clone the project, modify it 
and submit a pull request:
```bash
$ git clone https://github.com/ekkis/telegram-bot-now.git
```

## Support

Create a ticket on Github.  Reach out to me on Telegram.  You'll find me as [@ekkis](https://t.me/ekkis)
