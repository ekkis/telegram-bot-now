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
	noreturn: (m) => {
		// replies manually without return
		m.reply({text: 'manual return'});
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
	next_fn: async (m, meta) => {
		var steps = [
			{nm: 'cond', next: (rsp) => rsp == 'Yes' ? 1 : 2},
			{nm: 'yes'},
			{nm: 'no'}
		];
		return bot.utils.dialogue(m, steps, meta, {MSG: routes.MSG.NEXT})
	},
	next_msg_str: async (m, meta) => {
		var steps = [
			{nm: 'cond'}, {nm: 'yes'}, {nm: 'no'}
		];
		var MSG = {}.concat(routes.MSG.NEXT);
		MSG.COND.options = [{val: 'Yes', step: 'yes'}, {val: 'No', step: 'no'}]
		return bot.utils.dialogue(m, steps, meta, {MSG})
	},
	next_msg_nbr: async (m, meta) => {
		var steps = [
			{nm: 'cond'}, {nm: 'yes'}, {nm: 'no'}
		];
		var MSG = {}.concat(routes.MSG.NEXT);
		MSG.COND.options = [{val: 'Yes', step: 1}, {val: 'No', step: 2}]
		return bot.utils.dialogue(m, steps, meta, {MSG})
	},
	skipped: async (m, meta) => {
		var steps = [
			{nm: 'initial', post: s => ({name: s})},
			{nm: 'interim', skip: v => v == 'ziggy'},
			{nm: 'final'}
		];
		return bot.utils.dialogue(m, steps, meta, {MSG: routes.MSG.SKIPPED})
	},
	loop: async (m, meta) => {
		var prompts = 'abc'.split('')
		meta.dialogue.setpath('i', 0, true);
		var steps = [
			{nm: 'amts', next: (v, r) => {
				return (++meta.dialogue.i == prompts.length) ? 1 : 0
			}},
			{nm: 'thanks', post: (v, r) => {
				var result = r[3].val + ': ' + r[0].val + r[1].val + r[2].val
				return {result};
			}},
			{nm: 'final'}
		];
		return bot.utils.dialogue(m, steps, meta, {MSG: routes.MSG.LOOP})
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
		},
		SKIPPED: {
			INITIAL: 'Greetings. What\'s your name?',
			FINAL: 'Good bye'
		},
		LOOP: {
			AMTS: 'Enter value for %{amts}',
			THANKS: 'Thanks.  Enter a name now',
			FINAL: 'Your response was %{result}'
		}
	}
}

var state = {
	cache: {
		[bot.info.username]: {
			[username]: {
				'dialogue': {}
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

bot.utils.get = (key, cmd) => {
	return Promise.resolve({
		ok: true,
		result: {
			username: 'tbn_test_bot',
			first_name: 'TBN Test Bot'
		}
	})
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

	bot.utils.post = (key, msg) => {
		// removes functions 
		msg = JSON.parse(JSON.stringify(msg));
		if (!('photo' in msg)) msg.photo = undefined;
		expected.cmd = msg.cmd;
		expected.args = msg.args;
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
		url += '/server.js?bot=xxx'		
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
			'/array to check that array returns work',
			'/noreturn replies manually without return'
		]
		return test(url, '/help', expected.join('  \n'))
	})
	it('pings the server', async () => {
		return test(url, '/ping', 'pong!')
	})
	it('case insensitive', async () => {
		return test(url, '/PING', 'pong!')
	})
	it('slashes optional', async () => {
		return test(url, 'ping', 'pong!')
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
	it('handles manual replies (no return', () => {
		return test(url, '/noreturn', 'manual return')
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
	it.skip('supports markdown', () => {

	})
	it.skip('supports contact info', () => {

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
	describe('Dialogue cancellation', () => {
		it('initial step', () => {
			return test(url, '/chat', routes.MSG.CHAT.INITIAL)
		})
		it('interim step', () => {
			return test(url, '/cancel', bot.MSG.CANCELLED)
		})
		it('final step', () => {
			return test(url, 'whatever!', bot.MSG.UNDEFINED)
		})
	})
	describe('Conditional dialogues', () => {
		describe('Function - Path 1', () => {
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
				return test(url, '/next_fn', routes.MSG.NEXT.COND.text, opts)
			})
			it('Reply', () => {
				return test(url, 'Yes', routes.MSG.NEXT.YES)
			})
		})
		describe('Function - Path 2', () => {
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
				return test(url, '/next_fn', routes.MSG.NEXT.COND.text, opts)
			})
			it('Reply', () => {
				return test(url, 'No', routes.MSG.NEXT.NO)
			})
		})
		describe('String - Path Yes', () => {
			it('Condition', () => {
				var opts = {
					options: [{val: 'Yes', step: 'yes'}, {val: 'No', step: 'no'}], 
					reply_markup: {
						keyboard: [['Yes', 'No']],
						one_time_keyboard: true,
						resize_keyboard: true,
						selective: false
					}
				}	
				return test(url, '/next_msg_str', routes.MSG.NEXT.COND.text, opts)
			})
			it('Reply', () => {
				return test(url, 'Yes', routes.MSG.NEXT.YES)
			})
		})
		describe('String - Path No', () => {
			it('Condition', () => {
				var opts = {
					options: [{val: 'Yes', step: 'yes'}, {val: 'No', step: 'no'}], 
					reply_markup: {
						keyboard: [['Yes', 'No']],
						one_time_keyboard: true,
						resize_keyboard: true,
						selective: false
					}
				}	
				return test(url, '/next_msg_str', routes.MSG.NEXT.COND.text, opts)
			})
			it('Reply', () => {
				return test(url, 'No', routes.MSG.NEXT.NO)
			})
		})
		describe('Number', () => {
			it('Condition', () => {
				var opts = {
					options: [{val: 'Yes', step: 1}, {val: 'No', step: 2}], 
					reply_markup: {
						keyboard: [['Yes', 'No']],
						one_time_keyboard: true,
						resize_keyboard: true,
						selective: false
					}
				}	
				return test(url, '/next_msg_nbr', routes.MSG.NEXT.COND.text, opts)
			})
			it('Reply', () => {
				return test(url, 'No', routes.MSG.NEXT.NO)
			})
		})
	})
	describe('Dialogue skipping', () => {
		it('initial step', () => {
			return test(url, '/skipped', routes.MSG.CHAT.INITIAL)
		})
		it('interim step', () => {
			var name = 'ziggy';
			return test(url, name, routes.MSG.CHAT.FINAL)
		})
	})
	describe('Dialogue loops', () => {
		var msg = routes.MSG.LOOP;
		it('start', () => test(url, '/loop', msg.AMTS))
		it('first response', () => test(url, 'A', msg.AMTS))
		it('second response', () => test(url, 'B', msg.AMTS))
		it('third response', () => test(url, 'C', msg.THANKS))
		it('thanks', () => {
			return test(url, 'TEST', msg.FINAL.sprintf({result: 'TEST: ABC'}))
		})
	})
})
