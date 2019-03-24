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
const bot = "https://api.telegram.org/bot" + API_KEY;

// local state

var dialogues = {};
const FAIL = "An unexpected error has occurred.  Please report it to the bot /owner";

// useful to client
utils.msg = send;

var self = module.exports = {
	version: pkg.version, 
	utils, 
	server: (routes, opts) => {
		opts = Object.assign({}, config, opts);

		// sanitise messages
		if (!routes.MSG || typeof routes.MSG != "object") routes.MSG = {};

		return async (req, res) => {
			var js, m;
			try {
				js = await json(req); m = msg(js);
				if (self.DEBUG) console.log('INPUT MSG', JSON.stringify(js));
	
				// the route is specified in the request but overridden
				// by dialogues.  if none specified an 'undefined' route
				// is expected to be defined in the customer object
	
				let route = routes[m.cmd || dialogues[m.username]] 
					|| routes['undefined'];
				m.text = await route(m, js);
	
				// conversations can be enabled from within the route by
				// merely setting the 'dialogue' property to true/false
	
				if ('dialogue' in m) {
					if (!m.dialogue) dialogues[m.username] = undefined;
					else if (m.cmd) dialogues[m.username] = m.cmd;
				}
	
				await send(m);
			} catch(err) {
				// transmit the error
				opts.err("-- telegram-bot-now::server() general catch --");
				opts.err(err);
	
				// if a message could be produced, notify the user/group
				if (m) {
					try {
						let s = routes.MSG[err.message] || "";
						m.text = s || routes.MSG['FAIL'] || FAIL;
						await send(m);	
					}
					catch(e) {
						opts.err("-- telegram-bot-now::send() send within catch fail --");
						opts.err(e); 
					}
				}	
			} finally {
				res.end("ok"); // always return ok
			}
		};
	}
};

function msg(js) {
	var m = js.message;
	var [args, cmd] = m.reply_to_message 
		? [m.reply_to_message.text]
		: [m.text];
		
	if (args.startsWith('/')) {
		let x; [x, cmd, args] = args.match(/^\/(\w+)(?:\s+(.*))?/);
	}
	var ret = {
		chat_id: m.chat.id,
		chat_type: m.chat.type,
		username: m.from.username,
		parse_mode: 'Markdown',
		method: 'sendMessage',
		cmd, args: args || '',
		reply(o) {
			if (!o) throw new Error('-- telegram-bot-now::msg(): No reply specified --');
			var m = Object.assign({}, this);
			if (typeof o == 'string') m.text = o;
			else m = Object.assign(m, o);
			return send(m);
		}
	};

	if (m.chat.type == 'group')
		ret.reply_to_message_id = m.message_id;

	return ret;
}
	
function send(msg) {
	if (!msg) msg = this;
	if (!msg.text) return;
	
	var ret = Promise.resolve(true);
	var msgs = (typeof msg.text == 'string') ? [msg.text] : msg.text;
	msgs = msgs.map(s => s.split(/^\s*---/m)).flat();
	for (var i = 0; i < msgs.length; i++) {
		ret = post(ret, Object.assign({}, msg, {text: msgs[i].trimln()}));
	}
	return ret;

	function post(p, msg) {
		return p.then(() => fetch(bot + '/' + msg.method, {
			method: 'post',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(msg)
		}))
		.then(res => res.json())
		.then(res => {
			if (self.DEBUG)
				console.log('OUTPUT MSG', JSON.stringify(msg));
			if (!res.ok) {
				console.log("-- telegram-bot-now::send() fetch fail --");
				console.dir(res, {depth:null});
				console.dir(msg, {depth:null});
			}
		});
	}
}