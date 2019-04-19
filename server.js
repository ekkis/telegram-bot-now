const {json} = require('micro');
const pkg = require('./package.json');
const utils = require('./utils');

// local state

var self = module.exports = {
	info: { version: pkg.version },
	utils, 
	MSG: {
		START: 'Welcome.  Your wish is my command.',
		UNDEFINED: 'You have typed an unsupported command.  Please refer to /help and try again.',
		FAIL: 'An unexpected error has occurred.  Please report it to the bot /owner',
		CANCELLED: 'Your session has been cancelled.'
	},
	server: (routes, opts) => {
		utils.server = self;
		if (opts.bind) utils.bind(opts.bind).catch(die).then(res => {
			self.info.username = res.username;
			self.info.name = res.first_name;
			opts.state.save(res.username, null, 'bot', self.info);
		});

		// sanitise messages
		if (!routes.MSG || typeof routes.MSG != "object") routes.MSG = {};

		// default messages and routes
		var defaults = {
			help: () => utils.help(routes),
			version: () => self.info.version
		}
		'start/undefined/help'.split('/').forEach(s => {
			if (!routes[s]) routes[s] = () => self.MSG[s.uc()] || defaults[s]();
		})

		function bot_info(req) {
			var bot = utils.url(req.url).bot;
			if (!bot) return Promise.resolve({username: 'test_bot'});
			return opts.state.get(bot, null, 'bot').then(res => {
				res.url = 'https://' + req.headers.host;
				res.username = bot;
				return res;
			})
		}

		return async (req, res) => {
			var js, m;
			try {
				var bot = await bot_info(req);
				Object.assign(self.info, bot);

				if (req.method == 'GET') {
					js = m = utils.url(req.url);
				}
				else if (req.method == 'POST') {
					js = await json(req); m = msg(js);
				}
				else throw new Error('Unsupported method [' + req.method + ']');
				utils.debug('INPUT', js);
	
				// the route is specified in the request but overridden
				// by dialogues.  if none specified an 'undefined' route
				// is expected to be defined in the customer object

				var dialogue = await opts.state.get(
					bot.username, m.username, 'dialogue'
				);
				var route = m.cmd || dialogue.route;
				if (route.match(/^cancel$/i)) {
					dialogue = undefined;
					m.text = self.MSG.CANCELLED;
				}
				else {
					route = routes[route] || routes['undefined'];
					m.text = await route(m, {req, dialogue, bot: self});
					if (!m.text) m.text = self.MSG[route.uc()];
				}
				await opts.state.save(
					bot.username, m.username, 'dialogue', dialogue
				);
	
				await utils.msg(bot.key, m);
			} catch(err) {
				// transmit the error
				utils.err(err);
	
				// if a message could be produced, notify the user/group
				if (!m) return;
				try {
					let s = routes.MSG[err.message] || "";
					m.text = s || routes.MSG['FAIL'] || self.MSG.FAIL;
					await utils.msg(m);	
				}
				catch(err) {
					utils.err(err); 
				}	
			} finally {
				res.end("ok"); // always return ok
			}
		};
	}
};

function msg(js) {
	var m = js.message;
	var cmd = '', args = (m.reply_to_message || m).text || '';
		
	if (args.startsWith('/')) {
		[, cmd, args] = args.match(/^\/(\w+)(?:\s+(.*))?/);
	}
	var ret = {
		chat_id: m.chat.id,
		chat_type: m.chat.type,
		username: m.from.username,
		firstname: m.from.firstname,
		parse_mode: 'Markdown',
		cmd, args: args || '',
		photo: m.photo,
		reply(o) {
			if (!o) throw new Error('-- telegram-bot-now::msg(): No reply specified --');
			var m = Object.assign({}, this);
			if (typeof o == 'string') m.text = o;
			else m = Object.assign(m, o);
			return utils.msg(m);
		},
		keyboard(r, resize = true, one_time = true, selective = false) {
			this.reply_markup = {
				keyboard: r,
				resize_keyboard: resize,
				one_time_keyboard: one_time,
				selective
			};
		},
		inline(r) {
			r = r.map(o => typeof o == 'string' ? {text: o, callback_data: o} : o);
			this.reply_markup = {
				inline_keyboard: [r]
			}
		}
	};

	// when the bot is conversing in a group, it should
	// always quote the request

	if (m.chat.type == 'group')
		ret.reply_to_message_id = m.message_id;

	return ret;
}

function die(e) {
	console.log(e);		// eslint-disable-line no-console
	process.exit(1);
}