var assert = require('assert').strict
var utils = require('../utils')

describe('HTML', () => {
    describe('Table', () => {
        it('base case', () => {
            var res = '<table><tr><th>title1</th><th>title2</th></tr><tr><td>data1</td><td>data2</td></tr></table>'
            assert.equal(utils.html.table('title1|title2', ['data1|data2']), res)
            })
    })
})

