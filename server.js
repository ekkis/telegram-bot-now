const {json} = require('micro');
const fetch = require('node-fetch');
const pkg = require('./package.json');
const utils = require('./utils');

var config = {
	err: console.log
};

// ensure we have Telegram account

const API_KEY = process.env.TELEGRAM_API_KEY; 
if (!API_KEY) throw new Error("No Telegram API key");
utils.bot = "https://api.telegram.org/bot" + API_KEY;

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
		opts = Object.assign({}, config, opts);
		utils.state = opts.state;
		utils.info = self.info;

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

		return async (req, res) => {
			var js, m;
			try {
				if (!self.info.url) self.info.url = 'https://' + req.headers.host;
				if (req.method == 'GET') {
					js = m = utils.url(req.url);
				}
				else if (req.method == 'POST') {
					js = await json(req); m = msg(js);
				}
				else throw new Error('Unsupported method [' + req.method + ']');

				if (self.DEBUG) {
					console.log('INPUT MSG')
					console.dir(js, {depth: null});
				}
	
				// the route is specified in the request but overridden
				// by dialogues.  if none specified an 'undefined' route
				// is expected to be defined in the customer object

				var app = self.info.username;
				var dialogue = await utils.state.get(
					app, m.username, 'dialogue'
				);
				var route = m.cmd || dialogue.route;
				if (route.match(/^cancel$/i)) {
					utils.state.rm(app, m.username, 'dialogue');
					m.text = self.MSG.CANCELLED;
				}
				else {
					route = routes[route] || routes['undefined'];
					m.text = await route(m, {req, dialogue});
					utils.state.save(app, m.username, 'dialogue', dialogue);
				}
	
				// requests coming in via url cannot post to a channel

				if (m.chat_id) utils.msg(m);
			} catch(err) {
				// transmit the error
				opts.err("-- telegram-bot-now::server() general catch --");
				opts.err(err);
	
				// if a message could be produced, notify the user/group
				if (!m) return;
				try {
					let s = routes.MSG[err.message] || "";
					m.text = s || routes.MSG['FAIL'] || self.MSG.FAIL;
					await utils.msg(m);	
				}
				catch(e) {
					opts.err("-- telegram-bot-now::send() send within catch fail --");
					opts.err(e); 
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
		let x; [x, cmd, args] = args.match(/^\/(\w+)(?:\s+(.*))?/);
	}
	var ret = {
		chat_id: m.chat.id,
		chat_type: m.chat.type,
		username: m.from.username,
		parse_mode: 'Markdown',
		cmd, args: args || '',
		photo: m.photo,
		reply(o) {
			if (!o) throw new Error('-- telegram-bot-now::msg(): No reply specified --');
			var m = Object.assign({}, this);
			if (typeof o == 'string') m.text = o;
			else m = Object.assign(m, o);
			return utils.msg(m);
		}
	};

	if (m.chat.type == 'group')
		ret.reply_to_message_id = m.message_id;

	return ret;
}

// TODO: this needs to be defined here due to the self.DEBUG reference.
// should be moved to utils

utils.msg = function(msg) {
	if (!msg) msg = this;
	if (!msg.text) return;
	if (!msg.method) msg.method = 'sendMessage';

	var msgs = (typeof msg.text == 'string') ? [msg.text] : msg.text;
	var splitter = o => typeof o == 'string' ? o.split(/^\s*---/m) : o;
	msgs = msgs.map(splitter).flat()
		.map(o => typeof o == 'string' ? {text: o.trimln()} : o)
		.map(photo);
	msg.text = '';

	var ret = Promise.resolve(true);
	for (var i = 0; i < msgs.length; i++) {
		ret = utils.post(ret, Object.assign({}, msg, msgs[i]))
			.then(res => {
				if (self.DEBUG) {
					console.log('OUTPUT MSG')
					console.dir(msg, {depth: null});
				}
				if (!res.ok) {
					console.log("-- telegram-bot-now::send() fetch fail --");
					console.dir(res, {depth: null});
					console.dir(msg, {depth: null});
				}
			});
	}
	return ret;

	function photo(o) {
		if (!o.photo) return o;
		return {
			method: 'sendPhoto', photo: o.photo
		}
	}
}