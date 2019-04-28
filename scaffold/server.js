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

/*
Lambda expressions in Now are stateless.  if you need to keep state across
calls (as is needed in dialogues), you'll need to provide a state machine.
Below is a skeleton you can fill in.  Keep in mind that saving data to the
filesystem (typically to /tmp) is not a good solution as it, too, is destroyed
when the virtual machine is shut down, so MongoDb is your friend.  Get an
account and install it like this:

$ npm install mongodb --save
*/

// to use MongoDb, uncomment the code below and edit it with relevant
// information.  You may delete the current implementation bodies as 
// they are stubs to make the scaffold work

// const MongoDb = require('mongodb')
// const dbc = MongoDb.MongoClient.connect(
// 	'your-connection-uri', { useNewUrlParser: true }
// );
// const dbn = 'your-database-name';
// const cnm = 'a-collection-name';

var state = {
	// remove the element below if using MongoDb
	cache: {
		[bot.info.username]: {
			'test_username': { 'dialogue': [] },
			null: {
				bot: { username: 'test_bot' }
			}
		}
	},
	get(app, user, k) {
		// if using MongoDb, remove the following
		// lines and uncomment the code below it

		var p = ['cache', app, user, k].join('/');
		return Promise.resolve(
			this.getpath(p) || {route: ''}
		);

		// return dbc.db(dbn).collection(cnm)
		// 	.then(t => t.find({app, user}))
		// 	.then(ls => ls.toArray())
		// 	.then(ls => (ls.length > 0 ? ls[0][k] : undefined) || {});
	},
	save(app, user, k, o) {
		// if using MongoDb, remove the following
		// lines and uncomment the code below it

		var p = ['cache', app, user, k].join('/');
		this.setpath(p, o);
		return Promise.resolve({created: true, id: 0});

		// return dbc.db(dbn).collection(cnm)
		// 	.then(t => t.updateOne({app, user}, o, {upsert: true}))
	}
}

module.exports = bot.server(self, {state});