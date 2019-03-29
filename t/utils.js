var assert = require('assert').strict
var utils = require('../utils')

describe('Prototypes', () => {
    describe('Arrays', () => {
        describe('unique', () => {
            it('Handles empty arrays', () => {
                var actual = [].unique();
                assert.deepEqual(actual, [])
            })
            it('Handles simple arrays', () => {
                var actual = [2, 3, 2, 5, 2].unique()
                assert.equal(actual.length, 3)
            })
            it('Handles arrays with objects', () => {
                var actual = [{n: 1}, {n: 2}, {n: 1}]
                assert.equal(actual.length, 3)
            })
        })
        describe('trim', () => {
            it('Empty array', () => {
                var actual = [].trim()
                assert.ok(Array.isArray(actual))
                assert.equal(actual.length, 0)
            })
            it('Base case', () => {
                var actual = ['  test\t'].trim()
                assert.deepEqual(actual, ['test'])
            })
            it('Multiple elements', () => {
                var actual = ['  test\t', '\t\ttest 2   '].trim()
                assert.deepEqual(actual, ['test', 'test 2'])
            })
            it('Non strings - objects', () => {
                var actual = ['  test\t', {x: 1}].trim()
                assert.deepEqual(actual, ['test', {x: 1}])
            })
            it('Array non recursion', () => {
                var actual = ['  test\t', [' inner ', '\tinner\t']].trim()
                assert.deepEqual(actual, ['test', [' inner ', '\tinner\t']])
            })
        })
        describe('flat', () => {
            it('Handles empty arrays', () => {
                var actual = [].flat()
                assert.ok(Array.isArray(actual))
                assert.equal(actual.length, 0)
            })
            it('Flat input', () => {
                var actual = [1, 3, 3];
                assert.deepEqual(actual.flat(), actual)
            })
            it('Base case', () => {
                var actual = [1, [2,3], 4].flat();
                assert.deepEqual(actual, [1,2,3,4])
            })
            it('Recursive', () => {
                var actual = [1, [2,[3,4]], 5].flat(2);
                assert.deepEqual(actual, [1,2,3,4,5])
            })
        })
        describe('upack', () => {
            it('Empty array', () => {
                var actual = [].unpack()
                assert.ok(Array.isArray(actual))
                assert.equal(actual.length, 0)
            })
            it('Empty array with modifier', () => {
                var actual = [].unpack(true)
                assert.equal(typeof actual, 'undefined')
            })
            it('Array with single element (integer)', () => {
                var actual = [3].unpack()
                assert.equal(typeof actual, 'number')
                assert.equal(actual, 3)
            })
            it('Array with single element (object)', () => {
                var actual = [{n: 1}].unpack()
                assert.deepEqual(actual, {n: 1})
            })
            it('Array with multiple elements', () => {
                var actual = 'a/b/c'.split('/').unpack()
                assert.deepEqual(actual, ['a', 'b', 'c'])
            })
        })
    })
    describe('Strings', () => {
        describe('sprintf', () => {
            it('Base case', () => {
                var actual = 'math: %{a} + %{b}'.sprintf({a: 1, b: 2})
                assert.equal(actual, 'math: 1 + 2')
            })
            it('Missing parameters', () => {
                var actual = 'math: %{a} + %{b}'.sprintf()
                assert.equal(actual, 'math: %{a} + %{b}')
            })
            it('String parameter', () => {
                var actual = 'math: %{a} + %{a}'.sprintf('')
                assert.equal(actual, 'math: %{a} + %{a}')
            })
            it('Multiple instances', () => {
                var actual = 'math: %{a} + %{a}'.sprintf({a: 1})
                assert.equal(actual, 'math: 1 + 1')
            })
        })
        describe('trimln', () => {
            it('Trims leading spaces', () => {
                var actual = '   x'.trimln()
                assert.equal(actual, 'x')
            })
            it('Trims leading tabs', () => {
                var actual = '\t\tx'.trimln()
                assert.equal(actual, 'x')
            })
            it('Trims mixed whitespace', () => {
                var actual = ' \tx'.trimln()
                assert.equal(actual, 'x')
            })
            it('Joins multilines', () => {
                var actual = 'line1\nline2\nline3'.trimln()
                assert.equal(actual, 'line1 line2 line3')
            })
            it('Respects double lines', () => {
                var actual = 'line1\n\nline2\n\nline3'.trimln()
                assert.equal(actual, 'line1 \nline2 \nline3')
            })
        })
    })
})
describe('HTML', () => {
    describe('Table', () => {
        it('base case', () => {
            var res = '<table><tr><th>title1</th><th>title2</th></tr><tr><td>data1</td><td>data2</td></tr></table>'
            assert.equal(utils.html.table('title1|title2', ['data1|data2']), res)
            })
    })
})
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
