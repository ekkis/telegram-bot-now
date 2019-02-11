module.exports = {
	start: async function(msg) {
		var s ="Welcome to *The Now Telegram Bot*\n";
		s += "To see what I'm capable of, type /help\n";
		return ;
	},

	help: async function(msg) {
		var s = "You can ask me to do any of the following:\n";
		s += "/help - this message\n"
		return s;
	},

	wrong: async function(msg) {
		var s = "The command you entered is Greek to me.  To see ";
		s += "a list of supported commands, type /help\n";
		return s;
	}
}

