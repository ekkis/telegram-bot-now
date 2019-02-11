# Telegram Bot Now 

This project offers a skeleton for easily creating Telegram bots using the Now 
serverless platform

## Installation

To grab the source code, run the following command:
```
$ git clone https://github.com/ekkis/telegram-bot-now.git
```
## Configuration

Open the file `routes.js` with your favourite editor.  The file exports an object with methods that define the behaviour of your bot.  One method for each `/command` the bot will recognise.  The methods are responsible for returning a string that will be returned to the user.  These strings may be decorated in Markdown.

Additionally, the methods are passed the entire message object as it arrives from the Telegram server, which is described in the official documentation at: https://core.telegram.org/bots/api#message and can inspect or manipulate the values therein.

At the very least the routes object must provide handers for the `/start` and `/help' commands, and a method named `wrong` that will run whenver the user types in a command the bot does not recognise.

## Deployment

After configuring the bot's behaviour, we can deploy it.  First install the `now` package:
```
$ npm install -g now
```
and then, in the root directory of your project, simply type:
```
mk
```
which will syncronise the source with the deployment platform, and bind the handler to it.  You can watch the progress by executing:
```
mk logs
```

## Additional Reading

The Medium article https://medium.com/@ekkis/building-a-telegram-bot-in-node-js-now-6daea82ca425 goes 
on at some length about the use of this project and provides troubleshooting guidance

## Support

For support, create a ticket here on Github, or reach out to me on Telegram, where I may be found as `@ekkis`
