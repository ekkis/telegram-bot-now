const {json, send} = require('micro');
const fetch = require('node-fetch');
const routes = require('./routes');

const bot_url = "https://api.telegram.org/bot" + process.env.TELEGRAM_API_KEY;

module.exports = async (req, res) => {
	try {
		let msg = (await json(req)).message;
		let m = msg.text.match(/\/?([^\s]*)/);
		let s = await (routes[m[1]] || routes["wrong"])(msg);
		if (typeof s === 'string') msg.text = s;
		await post(msg);
		res.end("ok");
	} catch(err) {
		send(res, 500, {error: "Error: " + err});
	}
}

async function post(msg) {
	var o = {
		chat_id: msg.chat.id, text: msg.text,
		reply_to_message_id: msg.message_id,
		parse_mode: 'Markdown'
	};
	return fetch(bot_url + "/sendMessage", {
		method: 'post',
		body: JSON.stringify(o),
		headers: {'Content-Type': 'application/json'}
	});
}
