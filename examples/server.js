const {server, utils} = require('telegram-bot-now');

var self = {
	start: function(msg) {
		return self.MSG.START;
	},

	undefined: () => {
		return self.MSG.GREEK;
	},

	ping: () => {
		// to check the server's alive

		console.log('* ping');
		return 'pong!';
	},

	hello: (m) => {
		m.reply({ text: 'Hi there, ' + m.username });
	},

	version: () => {
		// returns the server version (it can be your own)

		return self._server.version;
	},


	help: () => {
		// this message

		return utils.help(self);
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

module.exports = server(self);