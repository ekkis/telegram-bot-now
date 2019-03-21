const bot = require('telegram-bot-now');

var self = {
	start: function(msg) {
		return self.MSG.START;
	},

	undefined: () => {
		return self.MSG.GREEK;
	},

	ping: () => {
		// to check that the server is alive

		console.log('* ping');
		return 'pong!';
	},

	hello: (m) => {
		// an example of a greeting

		m.reply({ text: 'Hi there, ' + m.username });
	},

	version: () => {
		// returns the server version (it can be your own)

		return self._server.version;
	},


	help: () => {
		// this message

		return bot.utils.help(self);
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