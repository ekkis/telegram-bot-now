const fetch = require('node-fetch');
const jsp = require('js-prototype-lib');

// convenience transform functions

var xf = {
    uc: (s = '') => s.uc(),
    lc: (s = '') => s.lc(),
    tc: (s = '') => s.lc().replace(/(^|\s)\S/g, t => t.uc()),
    n: (s) => parseFloat(s),
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
        opts = Object.assign({fields: step, throwPrefix: state.route}, opts)
		var val = self.parse(msg, opts);
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
        if (steps.length == state.rsp.length) o.state = undefined;
		return ret.sprintf(typeof val == 'object' ? val : state.rsp.last());
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
        var [, args] = s.split('?');
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
    },
    msg: (msg) => {
        if (!msg) msg = this;
        if (!msg.text) return;
        if (!msg.method) msg.method = 'sendMessage';
    
        var msgs = (typeof msg.text == 'string') ? [msg.text] : msg.text;
        var splitter = o => typeof o == 'string' ? o.split(/^\s*---/m) : o;
        msgs = msgs.map(splitter).flat()
            .map(o => typeof o == 'string' ? {text: o.trimln()} : o)
            .map(photo);
        msg.text = '';
    
        var ret = Promise.resolve(true);
        for (var i = 0; i < msgs.length; i++) {
            ret = self.post(ret, Object.assign({}, msg, msgs[i]))
                .then(res => {
                    self.debug('OUTPUT', msg);
                    if (!res.ok) self.err({res, msg});
                });
        }
        return ret;
    
        function photo(o) {
            if (!o.photo) return o;
            return {
                method: 'sendPhoto', photo: o.photo
            }
        }
    },
    debug: (title, obj) => {
        if (!self.server.DEBUG) return;
        console.log(title);					// eslint-disable-line no-console
        console.dir(obj, {depth: null});	// eslint-disable-line no-console
    },
    err: (e) => {
        console.error(e);                   // eslint-disable-line no-console
    }
}

jsp.install();
