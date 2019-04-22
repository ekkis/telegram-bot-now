const bot = require('telegram-bot-now');

// please note that routes marked as optional will have defaults
// provided unless defined.  for more information on the default
// behaviour see docs

var self = {
	// optional
	start: function(msg) {
		return self.MSG.START;
	},

	// optional
	undefined: () => {
		return self.MSG.GREEK;
	},

	// optional 
	version: () => {
		return 1;
	},

	// optional
	help: () => {
		// command index

		return bot.utils.help(self, 'The commands I can perform:\n\n\n%{help}');
	},

	ping: () => {
		// checks the server's pulse

		console.log('* ping');
		return 'pong!';
	},

	hello: (m) => {
		// an example of a greeting

		m.reply({ text: 'Hi there, ' + m.username });
	},

	MSG: {
		START: `
		Welcome to *Your Now Telegram Bot*.
		To see what I'm capable of, type /help
		`,
		GREEK: `
		The command you entered is Greek to me.  To see a list of 
		supported commands, type /help
		`
	}
}

// Now lambda expressions are stateless.  if you need to keep state across
// calls (as is needed in dialogues), provide a state machine.  Below is a
// skeleton you can fill in.  Keep in mind that saving data to the filesystem
// is not a good solution as it, too, is destroyed when the virtual machine is
// shut down, so MongoDb is your friend

var state = {
	cache: {
		[bot.info.username]: {
			'test_username': { 'dialogue': [] },
			null: {
				bot: { username: 'test_bot' }
			}
		}
	},
	get(app, user, k) {
		var p = ['cache', app, user, k].join('/');
		return this.getpath(p)
	},
	save(app, user, k, o) {
		var p = ['cache', app, user, k].join('/');
		this.setpath(p, o)
	},
	rm(app, user, k) {
		var p = ['cache', app, user, k].join('/');
		this.setpath(p, [])
	}
}

const env = process.env;
const bind = {								// set up a default Telegram
	key: env.TELEGRAM_BOT_KEY,				// webhook given the bot key
	url: env.TELEGRAM_BOT_URL				// and deployment url
}
module.exports = bot.server(self, {bind, state});