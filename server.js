const {json} = require('micro');
const pkg = require('./package.json');
const utils = require('./utils');

var init = false;

var self = module.exports = {
	info: { 
		version: pkg.version, 
		async get(req) {
			var {host} = req.headers;
			var {bot, script} = utils.urlargs(req.url);
			return this.concat(
				await utils.info(bot),
				// TODO: figure out whether the connection is encrypted
				// to generate an https url instead
				{host, url: 'http://' + host + script}
			);
		}	
	},
	server, utils, 
	MSG: {
		START: 'Welcome.  Your wish is my command.',
		UNDEFINED: 'You have typed an unsupported command.  Please refer to /help and try again.',
		FAIL: 'An unexpected error has occurred.  The bot /owner has been notified.',
		CANCELLED: 'Your session has been cancelled.'
	}
};

function server(routes, opts) {
	utils.server = self;

	// coalesce messages from multiple sources
	self.MSG.concat(routes.MSG, opts.MSG);

	// default messages and routes
	var defaults = {
		help: () => utils.help(routes),
		version: () => self.info.version
	}
	'start/undefined/help'.arr(s => {
		if (!routes[s]) routes[s] = () => self.MSG[s.uc()] || defaults[s]();
	})

	return async (req, res) => {
		var m, ret = '';
		try {
			// grab bot info from key
			
			var bot = await self.info.get(req);
	
			// if caller needs initialisation, run
			// and cache to avoid reinitialisation
	
			if (opts.init && !init)
				init = await opts.init() || true;
	
			// grab and format payload.  GET requests
			// will come in from websites and link-based
			// queries
	
			var js, meta = {req, bot: self, dialogue: {}};
			if (req.method == 'GET') {
				js = m = utils.urlargs(req.url);
			}
			else if (req.method == 'POST') {
				js = await json(req); m = msg(js);
			}
			else throw new Error('Unsupported method [' + req.method + ']');
			utils.debug('INPUT', js);
	
			if (opts.state)	meta.dialogue = await opts.state.get(
				bot.username, m.username, 'dialogue'
			);
			if (m.args.startsWith('/') || meta.dialogue.isEmpty()) {
				let [cmd, args] = m.args.splitn('\\s');
				m.cmd = cmd.replace('/', '').lc();
				m.args = args || '';
			}
	
			// the route is specified in the request but overridden
			// by dialogues.  if none specified an 'undefined' route
			// is expected to be defined in the customer object
	
			var route = m.cmd || meta.dialogue.route;
			if (route.match(/^\/?cancel$/i)) {
				meta.dialogue = undefined;
				m.text = self.MSG.CANCELLED;
			}
			else {
				let fn = routes[route] || routes['undefined'];
				m.text = await fn(m, meta);
				if (!m.text) m.text = self.MSG[route.uc()];
			}
			if (opts.state) await opts.state.save(
				bot.username, m.username, 'dialogue', meta.dialogue
			);
	
			ret = await utils.msg(bot.key, m);
		} catch(err) {
			utils.err(err);
			ret = err.obj();
	
			// if a message could be produced, notify the user/group
			if (!m) return;
			try {
				m.text = self.MSG[err.message] || self.MSG.FAIL;
				await utils.msg(self.info.key, m);	
			}
			catch(err) {
				utils.err(err); 
			}	
		} finally {
			var local = self.info.host.match(/localhost/);
			res.end(local ? ret.json() : 'ok');
		}
	}

	function msg(js) {
		var m = js.message;
		var {username, first_name} = m.from;
		var cmd = '', args = (m.reply_to_message || m).text || '';
		if (m.contact) args = m.contact.phone_number;
		var ret = {
			chat_id: m.chat.id,
			chat_type: m.chat.type,
			username, firstname: first_name,
			cmd, args,
			photo: m.photo,
			parse_mode: 'Markdown',
			reply(o) {
				if (!o) throw new Error('-- telegram-bot-now::msg(): No reply specified --');
				var m = Object.assign({}, this);
				if (typeof o == 'string') m.text = o;
				else m = Object.assign(m, o);
				return utils.msg(self.info.key, m);
			},
			keyboard(r, resize = true, one_time = true, selective = false) {
				if (r.isStr) r = [r.arr()];
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
				var cmd = this.args.nth(0, ' ')
				var args = this.args.replace(cmd, '').trim();
				return (ls.indexOf(cmd) == -1) ? '' : [cmd.lc(), args];
			},
			html() {
				this.parse_mode = 'HTML';
			},
			img(url) {
				this.photo = url;
			}
		};
	
		// when the bot is conversing in a group, it should
		// always quote the request
	
		if (m.chat.type == 'group')
			ret.reply_to_message_id = m.message_id;
	
		return ret;
	}
}