const fetch = require('node-fetch');

// convenience transform functions

var xf = {
    uc: (s) => { return (s || '').toUpperCase() },
    lc: (s) => { return (s || '').toLowerCase() },
    tc: (s) => { 
        return (s || '').toLowerCase()
            .replace(/(^|\s)\S/g, t => t.toUpperCase());
    },
    n: (s) => { return parseFloat(s) },
}

// prototype methods

if (!Array.prototype.unique)
    Array.prototype.unique = function() { 
        return this.filter((e, pos) => this.indexOf(e) == pos);
    }

if (!Array.prototype.trim)
    Array.prototype.trim = function() {
        return this.map(s => typeof s == 'string' ? s.trim() : s);
    }

if (!Array.prototype.flat) // polyfill for older versions of NodeJs that don't support this
	Array.prototype.flat = function(depth = 1) {
		var r = (ret, v) => ret.concat(Array.isArray(v) && depth > 0 ? v.flat(depth - 1) : v);
		return this.reduce(r, []);
    }

if (!Array.prototype.last)
    Array.prototype.last = function() {
        return this[this.length - 1];
    }

if (!Array.prototype.unpack)
    Array.prototype.unpack = function() {
        var l = this.length;
        return l == 1 ? this[0] 
            : l == 0 && arguments.length > 0
            ? undefined
            : this;
    }

if (!String.prototype.sprintf)
    String.prototype.sprintf = function(o) {
        var s = this.toString();
        if (typeof o != 'object') return s;
        for (var k in o)
            s = s.replace(new RegExp('%{' + k + '}', 'g'), o[k]);
        return s;
    };

if (!String.prototype.trimln)
    String.prototype.trimln = function(s) {
        return this.trim()
            .replace(/^[ \t]*/gm, '')
            .replace(/([^\n])\n/g, '$1 ');
    };

if (!String.prototype.uc)
    String.prototype.uc = function() { 
        return this.toUpperCase(); 
    }

if (!String.prototype.lc)
    String.prototype.lc = function() { 
        return this.toLowerCase(); 
    }

// utilities

var self = module.exports = {
    parse: (s, desc) => {
        var m = s;
        if (typeof s == 'object') s = s.args;
        if (desc.clean) {
            var re = desc.clean, rep = '';
            if (Array.isArray(desc.clean)) {
                re = '\\s*(' + desc.clean.join('|') + ')\\s*'
                re = new RegExp(re, 'ig');
                rep = ' ';
            }
            s = s.replace(re, rep);
        }

        var ret = {};
        var r = desc.split ? s.split(desc.split) : [s];
        if (!Array.isArray(desc.fields)) desc.fields = [desc.fields];
        for (var i = 0; i < desc.fields.length; i++) {
            let f = desc.fields[i];
            if (!r[i] && f.optional) continue;
            if (f.clean) r[i] = r[i].replace(f.clean, '');
            if (f.valid) {
                let vt = typeof f.valid;
                let ok = (vt == 'function')
                    ? f.valid(r[i], m)
                    : (f.valid instanceof RegExp) ? !!r[i].match(f.valid)
                    : false;
                if (!ok) {
                    let msg = f.throw;
                    if (!msg && desc.throwPrefix) 
                        msg = [desc.throwPrefix, f.nm, 'ERR'].join('_').uc();
                    if (!msg) msg = desc.throw || 'PARSE_FAIL';
                    throw {message: msg, field: f.nm};
                } else if (typeof ok != 'boolean') {
                    r[i] = ok;
                } else if (typeof ok == 'object' && ok.err) {
                    throw {message: ok.err, field: f.nm};
                }
            }
            
            var tx = typeof f.x;
            var x = tx == 'function' ? f.x 
                : tx == 'string' ? xf[f.x]
                : null;
            if (x) r[i] = x(r[i]);  // transform specified
            ret[f.nm] = r[i];
        } 
        var k = Object.keys(ret);
        return k.length == 1 ? ret[k[0]] : ret;
    },
    dialogue: async (o) => {
        var {msg, steps, state, opts, MSG} = o;
        if (msg.cmd) {
            state.route = msg.cmd;
            state.rsp = [];
        }

        var step = steps[state.rsp.length];
        var o = {fields: step, throwPrefix: state.route};
		var val = self.parse(msg, Object.assign(o, opts));
		state.rsp.push({nm: step.nm, val});

		if (step.post) {
            let post = await step.post(val, state.rsp);
            if (post) val = post;
        }

        // if no messages provided it's up to the caller
        // to generate them
        if (!MSG) return {nm: step.nm, val};

        // messages conform to a pattern: name of route, name of
        // step, joined with underscores, all uppercase

        var ret = MSG[[state.route, step.nm].join('_').uc()];
        if (!ret) throw new Error('No message for step [' + step.nm + ']');
		if (typeof ret == 'object') {
			msg.keyboard(val.choices || ret.choices);
			ret = ret.message;
        }
        o = typeof val == 'object' ? val : state.rsp.last();
		return ret.sprintf(o);
    },
    html: {
        table: (ths, trs) => {
            for (var i = 0; i < trs.length; i++) {
                if (!trs[i].match(/</))
                    trs[i] = '<tr><td>'+ trs[i].replace(/\|/g, '</td><td>') + '</td></tr>'
            }
            ths = '<tr><th>' + ths.replace(/\|/g, '</th><th>') + '</th></tr>';
            return '<table>' + ths +  trs + '</table>';
        }
    },
    help: (o, s) => {
        var ret = [];
        for (var k in o) {
            if (typeof o[k] !== 'function') continue;
            let fn = o[k].toString().split(/\n/);
            let rem = [];
            for (var ln of fn) {
                if (ln.match(/\s*\/\//))
                    rem.push(ln.replace("//", "").trim());
                else if (rem.length > 0) {
                    ret.push("/" + k + " " + rem.join(' '));
                    break;
                }
            }
        }
        ret = ret.join('\n\n\n');
        if (s) ret = s.sprintf({help: ret});
        return ret.trimln();
    },
    url: (s) => {
        var ret = {}; 
        var [base, args] = s.split('?');
        if (!args) return ret;

        var r = args.split(/[&=]/);
        for (var i = 0; i < r.length; i += 2) {
            ret[r[i]] = r[i+1];
        }   
        return ret;
    },
    post: (p, msg) => {
		return p.then(() => fetch(self.bot + '/' + msg.method, {
			method: 'post',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(msg)
		}))
		.then(res => res.json());
	}
}
