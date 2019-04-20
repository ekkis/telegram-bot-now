var assert = require('assert').strict
var utils = require('../utils')

describe('Help generator', () => {
    var doc = {
        route1: () => {
            // route1 doc
            return null
        },
        route2: () => {
            // route2 doc
            return null
        },
    }
    it('Base case', () => {
        var actual = utils.help(doc)
        var expected = '/route1 route1 doc \n\n/route2 route2 doc'
        assert.deepEqual(actual, expected)
    })
    it('Multiline support', () => {
        doc = {
            route: () => {
            // route multiline
            // doc comments
            return null
        }}
        var actual = utils.help(doc)
        var expected = '/route route multiline doc comments'
        assert.deepEqual(actual, expected)
    })

})
describe('Url parser', () => {
    it('No arguments - no index', () => {
        var href = 'http://tst.com'
        var actual = utils.url(href)
        var expected = {}
        assert.deepEqual(actual, expected)
    })
    it('No arguments with index', () => {
        var href = 'http://tst.com/'
        var actual = utils.url(href)
        var expected = {}
        assert.deepEqual(actual, expected)
    })
    it('Handles arguments', () => {
        var href = 'http://tst.com/?arg1=val1&arg2=val2'
        var actual = utils.url(href)
        var expected = { arg1: 'val1', arg2: 'val2' }
        assert.deepEqual(actual, expected)
    })
})
describe('Parse', () => {
    describe('Complete command', () => {
        var cd = {
            clean: ['for', '@', 'at'],
            split: /\s+/,
            fields: [
                {nm: 'qty', valid: /^\d+(?:\.\d+)?$/, x: 'n'},
                {nm: 'sell', valid: /^[a-z:]+$/, x: 'uc'},
                {nm: 'buy', valid: /^[a-z:]+$/, x: 'uc'},
                {nm: 'price', valid:/^\d+(?:\.\d+)?$/, x: 'n', optional: true},
                {nm: 'metric', valid:/^\w+\/\w+$/, x: 'uc', optional: true}
            ]
        }
        it('simple', async () => {
            var actual = await utils.parse('10 eth for btc', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC'}
            assert.deepEqual(actual, expected)
        })
        it('bad quantity', async () => {
            var res = {qty: 10, sell: 'ETH', buy: 'BTC'}
            try { await utils.parse('10. eth for btc', cd) }
            catch(e) {
                assert.deepEqual(e, {message: 'PARSE_FAIL', field: 'qty'})
            }
        })
        it('float quantity', async () => {
            var actual = await utils.parse('10.02 eth for btc', cd)
            var expected = {qty: 10.02, sell: 'ETH', buy: 'BTC'}
            assert.deepEqual(actual, expected)
        })
        it('price', async () => {
            var actual = await utils.parse('10 eth for btc @ 23', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23}
            assert.deepEqual(actual, expected)
        })
        it('bad price', async () => {
            var res = {qty: 10, sell: 'ETH', buy: 'BTC'}
            try { await utils.parse('10 eth for btc @ 23.', cd) }
            catch(e) {
                assert.deepEqual(e, {message: 'PARSE_FAIL', field: 'price'})
            }
        })
        it('decimal price', async () => {
            var actual = await utils.parse('10 eth for btc @ 23.01', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23.01}
            assert.deepEqual(actual, expected)
        })
        it('at price', async () => {
            var actual = await utils.parse('10 eth for btc at 23', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23}
            assert.deepEqual(actual, expected)
        })
        it('for for', async () => {
            var actual = await utils.parse('10 eth for for btc at 23', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23}
            assert.deepEqual(actual, expected)
        })
        it('price with cross', async () => {
            var actual = await utils.parse('10 eth for btc @ 23 eth/btc', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23, metric: 'ETH/BTC'}
            assert.deepEqual(actual, expected)
        })
        it('price with cross - no space', async () => {
            var res = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23, metric: 'ETH/BTC'}
            try { await utils.parse('10 eth for btc @ 23eth/btc', cd) }
            catch(e) {
                assert.deepEqual(e, {message: 'PARSE_FAIL', field: 'price'})
            }
        })
        it('price with single unit', async () => {
            var res = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23, metric: 'ETH'}
            try { await utils.parse('10 eth for btc @ 23 eth', cd) }
            catch(e) {
                assert.deepEqual(e, {message: 'PARSE_FAIL', field: 'metric'})
            }
        })
        it('regular expression for clean', async () => {
            cd.clean = /for|at|@/ig;
            var actual = await utils.parse('10 eth for btc', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC'}
            assert.deepEqual(actual, expected)
        })
    })
    describe('Dialogue mode', () => {
        var FAIL = {message: 'PARSE_FAIL', field: 'tst'}
        it('valid input accepted', async () => {
            var v = '200-3'
            var actual = await utils.parse(v, {fields: {nm: 'tst', valid: /-/}})
            assert.equal(actual, v);
        })
        it('invalid input rejected', async () => {
            try {
                await utils.parse('200/3', {fields: {nm: 'tst', valid: /-/}})
            }
            catch(e) {
                assert.deepEqual(e, FAIL)
            }
        })
        it('valid function accepts', async () => {
            var v = '200/3'
            var validate = s => s == v
            var actual = await utils.parse(v, {fields: {nm: 'tst', valid: validate}})
            assert.equal(actual, v)
        })
        it('valid function rejects', async () => {
            var validate = s => s != '200/3'
            try {
                await utils.parse('200/3', {fields: {nm: 'tst', valid: validate}})
            }
            catch(e) {
                assert.deepEqual(e, FAIL)
            }
        })
        it('post function supported', async () => {
            var v = '200/3'
            var fd = {nm: 'tst', 
                valid: s => s == v, 
                post: (actual) => {
                    assert.equal(actual, v)
                }
            }
            await utils.parse(v, {fields: fd})
        })
    })
})
