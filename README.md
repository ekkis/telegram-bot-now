# Telegram Bot Now 

This project offers a skeleton for easily creating Telegram bots using the Now 
serverless platform.  For more information on Now, see:

https://zeit.co/now

## Install

The project is available from NPM and can be installed in the usual way:
```
npm install --save telegram-bot-now
```
But to deploy your bot you'll need the Now client.  Install it like this:
```
$ npm install -g now
```

## Use

To get started create a local link to our maker utility:
```
ln -s node_modules/telegram-bot-now/mk
```
Now you can grab our sample code:
```
./mk example
```
> Please note: Windows users are out of luck unless they're using Cygwin 
> or another environment with bash support

## Deploy

To deploy your bot you'll first need to set up your Telegram API key as follows:
```
./mk secret <your-secret-api-key>
```
which will upload the key as a secret to the Now environment and display an export
statement you can use to initialise your local environment.  Without this key the
maker utility will not function

After that you can create a Now deployment very simply via the command:
```
./mk
```
The above will synchronise the local files in your project with the Now servers and authomatically
bind your deployment as a handler to your telegram bot using *webhooks*.  To see logs on the deployment:
```
./mk logs
```
To see other commands supported by the make utility:
```
./mk --help
```

## Additional Reading

For a complete description of how to set up routes, create dialogues, the various utilities provided
in the module, and troubleshooting guidance, please read the Medium article:

https://medium.com/@ekkis/building-a-telegram-bot-in-node-js-now-6daea82ca425 

## Contribute

If there's some enhancement you'd like to contribute, please clone the project, modify it 
and submit a pull request:
```
$ git clone https://github.com/ekkis/telegram-bot-now.git
```

## Support

For support, create a ticket here on Github, or reach out to me on Telegram, where I may be found as `@ekkis`
