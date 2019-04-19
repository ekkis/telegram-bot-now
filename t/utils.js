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
        it('simple', () => {
            var actual = utils.parse('10 eth for btc', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC'}
            assert.deepEqual(actual, expected)
        })
        it('bad quantity', () => {
            var res = {qty: 10, sell: 'ETH', buy: 'BTC'}
            var f = () => utils.parse('10. eth for btc', cd);
            assert.throws(f, {message: 'PARSE_FAIL', field: 'qty'})
        })
        it('float quantity', () => {
            var actual = utils.parse('10.02 eth for btc', cd)
            var expected = {qty: 10.02, sell: 'ETH', buy: 'BTC'}
            assert.deepEqual(actual, expected)
        })
        it('price', () => {
            var actual = utils.parse('10 eth for btc @ 23', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23}
            assert.deepEqual(actual, expected)
        })
        it('bad price', () => {
            var res = {qty: 10, sell: 'ETH', buy: 'BTC'}
            var f = () => utils.parse('10 eth for btc @ 23.', cd)
            assert.throws(f, {message: 'PARSE_FAIL', field: 'price'})
        })
        it('decimal price', () => {
            var actual = utils.parse('10 eth for btc @ 23.01', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23.01}
            assert.deepEqual(actual, expected)
        })
        it('at price', () => {
            var actual = utils.parse('10 eth for btc at 23', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23}
            assert.deepEqual(actual, expected)
        })
        it('for for', () => {
            var actual = utils.parse('10 eth for for btc at 23', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23}
            assert.deepEqual(actual, expected)
        })
        it('price with cross', () => {
            var actual = utils.parse('10 eth for btc @ 23 eth/btc', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23, metric: 'ETH/BTC'}
            assert.deepEqual(actual, expected)
        })
        it('price with cross - no space', () => {
            var res = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23, metric: 'ETH/BTC'}
            var f = () => utils.parse('10 eth for btc @ 23eth/btc', cd)
            assert.throws(f, {message: 'PARSE_FAIL', field: 'price'})
        })
        it('price with single unit', () => {
            var res = {qty: 10, sell: 'ETH', buy: 'BTC', price: 23, metric: 'ETH'}
            var f = () => utils.parse('10 eth for btc @ 23 eth', cd)
            assert.throws(f, {message: 'PARSE_FAIL', field: 'metric'})
        })
        it('regular expression for clean', () => {
            cd.clean = /for|at|@/ig;
            var actual = utils.parse('10 eth for btc', cd)
            var expected = {qty: 10, sell: 'ETH', buy: 'BTC'}
            assert.deepEqual(actual, expected)
        })
    })
    describe('Dialogue mode', () => {
        var FAIL = {message: 'PARSE_FAIL', field: 'tst'}
        it('valid input accepted', () => {
            var v = '200-3'
            var actual = utils.parse(v, {fields: {nm: 'tst', valid: /-/}})
            assert.equal(actual, v);
        })
        it('invalid input rejected', () => {
            var f = () => utils.parse('200/3', {fields: {nm: 'tst', valid: /-/}})
            assert.throws(f, FAIL);
        })
        it('valid function accepts', () => {
            var v = '200/3'
            var validate = s => s == v
            var actual = utils.parse(v, {fields: {nm: 'tst', valid: validate}})
            assert.equal(actual, v)
        })
        it('valid function rejects', () => {
            var validate = s => s != '200/3'
            var f = () => utils.parse('200/3', {fields: {nm: 'tst', valid: validate}})
            assert.throws(f, FAIL)
        })
        it('post function supported', () => {
            var v = '200/3'
            var fd = {nm: 'tst', 
                valid: s => s == v, 
                post: (actual) => {
                    assert.equal(actual, v)
                }
            }
            utils.parse(v, {fields: fd})
        })
    })
})
