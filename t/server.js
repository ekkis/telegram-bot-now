const assert = require('assert').strict
const micro = require('micro');
const listen = require('test-listen');
const request = require('request-promise');
const bot = require('../server');

const DEBUG = false;
const username = 'ekkis'
bot.info.username = 'tbn_test_bot'
const bot_photo = 'https://assets.wired.com/photos/w_1164/wp-content/uploads/2016/04/chat_bot-01.jpg'

// set up base routes

var routes = {
	ping: () => {
		// to check that the server is alive

		return 'pong!'
	},
	multi: () => {
		// to check that segmented messages work

		return `
			this is an example
			---
			of a segmented
			---
			message
			`
	},
	array: () => {
		// to check that array returns work

		return ['first', 'second']
	},
	sprintf: () => {
		return {text: 'my %{cardinal} fill-in', vars: {cardinal: 'first'}};
	},
	keyboard: (m) => {
		return {text: 'Pick one', options: 'Yes/No'}
	},
	image: (m) => {
		return bot_photo;
	},
	mixed: (m) => {
		return `
		caption text\n${bot_photo}
		`;
	},
	chat: async (m, meta) => {
		var steps = [
			{nm: 'initial', post: s => ({name: s})},
			{nm: 'interim'},
			{nm: 'final'}
		];
		return bot.utils.dialogue(m, steps, meta, {MSG: routes.MSG.CHAT})
	},
	next: async (m, meta) => {
		var steps = [
			{nm: 'cond', next: (rsp) => rsp == 'Yes' ? 1 : 2},
			{nm: 'yes'},
			{nm: 'no'}
		];
		return bot.utils.dialogue(m, steps, meta, {MSG: routes.MSG.NEXT})
	},
	MSG: {
		CHAT: {
			INITIAL: 'Greetings. What\'s your name?',
			INTERIM: 'Hello %{name}',
			FINAL: 'Good bye'
		},
		NEXT: {
			COND: {
				text: 'Pick one',
				options: 'Yes/No'
			},
			YES: 'Good choice',
			NO: 'Bad choice'
		}
	}
}

var state = {
	cache: {
		[bot.info.username]: {
			[username]: {
				'dialogue': []
			},
			null: {
				info: {
					username: bot.info.username
				}
			}
		}
	},
	get(app, user, k) {
		return this.cache[app][user][k] || {}
	},
	save(app, user, k, o) {
		this.cache[app][user][k] = o
	},
	rm(app, user, k) {
		this.cache[app][user][k] = []
	}
}

// support functions

function test(uri, cmd, res, exp) {
	var ret, i = 0;
	var expected =  {
		chat_id: '1',
		chat_type: 'private',
		username,
		parse_mode: 'Markdown',
		cmd: '',
		args: '',
		photo: undefined,
		method: 'sendMessage'
	}.concat(exp)

	bot.utils.get = (key, cmd) => {
		return Promise.resolve({
			ok: true,
			result: {
				username: 'tbn_test_bot',
				first_name: 'TBN Test Bot'
			}
		})
	}
	bot.utils.post = (key, msg) => {
		// removes functions 
		msg = JSON.parse(JSON.stringify(msg));
		if (!('photo' in msg)) msg.photo = undefined;
		expected.cmd = ''; expected.args = cmd
		if (cmd.startsWith('/')) {
			var x; [x, expected.cmd, expected.args]
				= cmd.match(/^\/(\w+)(.*)$/).trim()
		}
		expected.text = Array.isArray(res) ? res[i++] : res
		delete msg.vars;
		ret = Object.assign({}, msg)

		msg.ok = true
		return Promise.resolve(msg)
	}

	return request({
		uri, method: 'POST',
		json: true, // Automatically stringifies the body to JSON
		body: {
			message: {
				chat: {id: '1', type: 'private'},
				from: {username}, text: cmd
			}
		}
	})
	.catch(e => {
		console.log('REQUEST FAIL', e)	
	})
	.then(() => {
		return assert.deepEqual(ret, expected)
	})
}

// run tests

describe('Server routes', () => {
	bot.DEBUG = DEBUG;

	var service, url
	beforeEach(async () => {
		service = micro(bot.server(routes, {state}))
		url = await listen(service)		
	})
	afterEach(() => {
		service.close()
	})

	it('default start', async () => {
		return test(url, '/start', bot.MSG.START)
	})
	it('default undefined', async () => {
		return test(url, '/_0xFF00_', bot.MSG.UNDEFINED)
	})
	it('help', async () => {
		var expected = [
			'/ping to check that the server is alive',
			'/multi to check that segmented messages work',
			'/array to check that array returns work'
		]
		return test(url, '/help', expected.join('  \n'))
	})
	it('pings the server', async () => {
		return test(url, '/ping', 'pong!')
	})
	it('segments text into multiple messages', async () => {
		return test(url, '/multi', ['this is an example', 'of a segmented', 'message'])
	})
	it('handles arrays', async () => {
		return test(url, '/array', ['first', 'second'])
	})
	it('handles variable replacements', () => {
		return test(url, '/sprintf', 'my first fill-in')
	})
	it('supports custom keyboards', () => {
		var opts = {
			options: 'Yes/No', 
			reply_markup: {
				keyboard: [['Yes', 'No']],
				one_time_keyboard: true,
				resize_keyboard: true,
				selective: false
			}
		}
		return test(url, '/keyboard', 'Pick one', opts)
	})
	it.skip('supports subcommands', () => {
	
	})
	it.skip('supports replies', () => {

	})
	describe('Image support', () => {
		it('base case', () => {
			return test(url, '/image', '', {
				method: 'sendPhoto', photo: bot_photo, caption: ''
			})
		})
		it('mixed content', () => {
			return test(url, '/mixed', '', {
				method: 'sendPhoto', photo: bot_photo, caption: 'caption text'
			})
		})
	})
	describe('Dialogue support', () => {
		it('initial step', () => {
			return test(url, '/chat', routes.MSG.CHAT.INITIAL)
		})
		it('interim step', () => {
			var name = 'ziggy';
			return test(url, name, routes.MSG.CHAT.INTERIM.sprintf({name}))
		})
		it('final step', () => {
			return test(url, 'whatever!', routes.MSG.CHAT.FINAL)
		})
	})
	describe('Conditional dialogue - Path 1', () => {
		it('Condition', () => {
			var opts = {
				options: 'Yes/No', 
				reply_markup: {
					keyboard: [['Yes', 'No']],
					one_time_keyboard: true,
					resize_keyboard: true,
					selective: false
				}
			}	
			return test(url, '/next', routes.MSG.NEXT.COND.text, opts)
		})
		it('Reply', () => {
			return test(url, 'Yes', routes.MSG.NEXT.YES)
		})
	})
	describe('Conditional dialogue - Path 2', () => {
		it('Condition', () => {
			var opts = {
				options: 'Yes/No', 
				reply_markup: {
					keyboard: [['Yes', 'No']],
					one_time_keyboard: true,
					resize_keyboard: true,
					selective: false
				}
			}	
			return test(url, '/next', routes.MSG.NEXT.COND.text, opts)
		})
		it('Reply', () => {
			return test(url, 'No', routes.MSG.NEXT.NO)
		})
	})
})
