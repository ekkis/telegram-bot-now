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
		FAIL: 'An unexpected error has occurred.  The bot /owner has been notified.',
		CANCELLED: 'Your session has been cancelled.'
	},
	server: (routes, opts) => {
		utils.server = self;

		// coalesce messages from multiple sources
		Object.assign(self.MSG, routes.MSG, opts.MSG);

		// default messages and routes
		var defaults = {
			help: () => utils.help(routes),
			version: () => self.info.version
		}
		'start/undefined/help'.split('/').forEach(s => {
			if (!routes[s]) routes[s] = () => self.MSG[s.uc()] || defaults[s]();
		})

		async function bot_info(req) {
			var args = utils.urlargs(req.url);
			var ret = await utils.info(args.bot);
			self.info.concat(ret);
			return self.info;
		}

		return async (req, res) => {
			var m, bot;
			try {
				bot = await bot_info(req);

				var js;
				if (req.method == 'GET') {
					js = m = utils.urlargs(req.url);
				}
				else if (req.method == 'POST') {
					js = await json(req); m = msg(js);
				}
				else throw new Error('Unsupported method [' + req.method + ']');
				utils.debug('INPUT', js);
	
				// the route is specified in the request but overridden
				// by dialogues.  if none specified an 'undefined' route
				// is expected to be defined in the customer object

				var meta = {req, bot: self};
				meta.dialogue = await opts.state.get(
					bot.username, m.username, 'dialogue'
				);
				var route = m.cmd || meta.dialogue.route;
				if (route.match(/^cancel$/i)) {
					meta.dialogue = undefined;
					m.text = self.MSG.CANCELLED;
				}
				else {
					let fn = routes[route] || routes['undefined'];
					m.text = await fn(m, meta);
					if (!m.text) m.text = self.MSG[route.uc()];
				}
				await opts.state.save(
					bot.username, m.username, 'dialogue', meta.dialogue
				);
				await utils.msg(bot.key, m);

			} catch(err) {
				utils.err(err);
	
				// if a message could be produced, notify the user/group
				if (!m) return;
				try {
					m.text = self.MSG[err.message] || self.MSG.FAIL;
					await utils.msg(bot.key, m);	
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
			return utils.msg(self.info.key, m);
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
		},
		subcmd(ls) {
			var cmd = this.args.nth(0)
			var args = this.args.replace(cmd, '').trim();
			return (ls.indexOf(cmd) == -1) ? '' : [cmd.lc(), args];
		}
	};

	// when the bot is conversing in a group, it should
	// always quote the request

	if (m.chat.type == 'group')
		ret.reply_to_message_id = m.message_id;

	return ret;
}