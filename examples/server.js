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

module.exports = bot.server(self);