const assert = require('assert').strict
const micro = require('micro');
const listen = require('test-listen');
const request = require('request-promise');
const bot = require('../server');

const DEBUG = false;
bot.info.username = 'test_bot'

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
	chat: async (m, meta) => {
		var steps = [
			{nm: 'initial'},
			{nm: 'interim', post: s => ({name: s})},
			{nm: 'final'}
		];
		return bot.utils.dialogue({
			msg: m, steps, 
			state: meta.dialogue,
			MSG: routes.MSG
		})
	},
	MSG: {
		CHAT_INITIAL: 'Greetings. What\'s your name?',
		CHAT_INTERIM: 'Hello %{name}',
		CHAT_FINAL: 'Good bye'
	}
}

var state = {
	cache: {
		[bot.info.username]: {
			'ekkis': {
				'dialogue': []
			},
			null: {
				bot: {
					username: 'test_bot'
				}
			}
		}
	},
	get(app, user, k) {
		return this.cache[app][user][k]
	},
	save(app, user, k, o) {
		this.cache[app][user][k] = o
	},
	rm(app, user, k) {
		this.cache[app][user][k] = []
	}
}

// support functions

function test(uri, cmd, res) {
	bot.utils.post = equal(cmd, res)
	return request({
		uri, method: 'POST',
		json: true, // Automatically stringifies the body to JSON
		body: {
			message: {
				chat: {id: '1', type: 'private'},
				from: {username: 'ekkis'},
				text: cmd
			}
		}
	})
	.catch(e => {
		console.log('REQUEST FAIL', e)	
	})
}

function equal(cmd, res) {
	var expected =  {
		chat_id: '1',
		chat_type: 'private',
		username: 'ekkis',
		parse_mode: 'Markdown',
		cmd: '',
		args: '',
		photo: undefined,
		method: 'sendMessage'
	}

	var i = 0;
	return (key, msg, p) => {
		// removes functions 
		msg = JSON.parse(JSON.stringify(msg));
		if (!('photo' in msg)) msg.photo = undefined;
		expected.cmd = ''; expected.args = cmd
		if (cmd.startsWith('/')) {
			var x; [x, expected.cmd, expected.args]
				= cmd.match(/^\/(\w+)(.*)$/).trim()
		}
		expected.text = Array.isArray(res) ? res[i++] : res;
		assert.deepEqual(msg, expected)

		msg.ok = true
		return p.then(() => msg)
	}
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
	describe('Dialogue support', () => {
		it('initial step', () => {
			return test(url, '/chat', routes.MSG.CHAT_INITIAL)
		})
		it('interim step', () => {
			var name = 'ziggy';
			return test(url, name, routes.MSG.CHAT_INTERIM.sprintf({name}))
		})
		it('final step', () => {
			return test(url, 'whatever!', routes.MSG.CHAT_FINAL)
		})
	})
})
