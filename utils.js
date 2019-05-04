const fetch = require('node-fetch');
const jsp = require('js-prototype-lib');
const njsutil = require('util');

// grab all prototypes

jsp.install();

// convenience transform functions

var xf = {
    uc: (s = '') => s.uc(),
    lc: (s = '') => s.lc(),
    tc: (s = '') => s.lc().replace(/(^|\s)\S/g, t => t.uc()),
    n: (s) => parseFloat(s),
}

var self = module.exports = {
    parse: async (s, desc) => {
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
                    ? await f.valid(r[i], m)
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
    dialogue: async (msg, steps, meta, opts) => {
        var step, val = {}, state = meta.dialogue || {};
        if (msg.cmd) {
            state.route = msg.cmd;
            state.next = 0;
            state.rsp = [];
        }
        else {
            step = steps[state.next];
            opts = {fields: step, throwPrefix: state.route}.concat(opts);
            val = await self.parse(msg, opts);
            state.rsp.push({nm: step.nm, val});
    
            if (step.post) {
                let post = await step.post(val, state.rsp);
                if (post) val = post;
            }
            if (step.next) state.next = step.next(val);
            else state.next++;
        }
        step = steps[state.next];

        // the last step in the dialogue has been reached
        // so we clear state as an indication to caller

        if (state.next == steps.length - 1) meta.dialogue = undefined;

        // if no messages provided it's up to the caller
        // to generate them

        if (!opts.MSG) return state.rsp.last();

        var ret = opts.MSG[step.nm.uc()];
        if (!ret) die('No message for step [' + step.nm + ']');
        if (ret.isStr) ret = { 
            text: ret, vars: val.isObj ? val : (state.rsp.last() || {})
        };
        var kbd = val.options || val.choices;
        if (kbd) ret.options = kbd;
        if (!Array.isArray(ret)) ret = [ret];
        return ret;
    },
    msg: (key, msg) => {
        if (!msg) msg = this;
        if (!msg.text) return;
        if (!msg.chat_id) return;
        if (!msg.method) msg.method = 'sendMessage';
    
        var msgs = (Array.isArray(msg.text) ? msg.text : [msg.text])
            .map(objs).map(splitter).flat()
            .map(vars)
            .map(keyboards)
            .map(attachments);
        msg.text = '';
    
        var ret = Promise.resolve(true);
        for (let i = 0; i < msgs.length; i++) {
            ret = ret.then(() => self.post(key, {}.concat(msg, msgs[i])));
        }
        return ret;

        function objs(o = '') {
            var isObj = typeof o == 'object' && !Array.isArray(o);
            return isObj ? o : {text: o.toString()};
        }
        function splitter(o) {
            if (!o.text.isStr) return [o.text];
            var r = o.text.split(/^\s*---/m);
            return r.map(x => Object.assign({}, o, {text: x.heredoc()}));
        }
        function vars(o) {
            if (o.vars && o.text.isStr)
                o.text = o.text.sprintf(o.vars)
            return o;
        }
        function keyboards(o) {
            var opts = o.options || o.choices;
            if (opts) msg.keyboard(opts)
            return o;
        }
        function attachments(o) {
            if (o.photo) return {
                method: 'sendPhoto', photo: o.photo
            }
            if (o.document) return {
                method: 'sendDocument', document: o.document
            }
            return o;
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
        return ret.heredoc();
    },
    urlargs: (s) => {
        var [, args] = s.split('?');
        return args ? args.keyval('=', '&') : {};
    },
    tg: (key, method) => {
        if (!key) die('No Telegram bot API key');
        if (!method) die('No method specified for Telegram call');
        return 'https://api.telegram.org/bot' + key + '/' + method;
    },
    get: (key, cmd) => {
        return fetch(self.tg(key, cmd))
            .then(res => res.json());
    },
    post: (key, msg) => {
		return fetch(self.tg(key, msg.method), {
			method: 'post',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(msg)
        })
        .then(res => res.json())
        .then(res => {
            if (res.ok) self.debug('POST', {msg, res});
            else throw {msg, res};
            return res;
        })
        .catch(e => {
            if (e.code == 'ECONNRESET')
                return self.post(key, msg);
            self.err(e, 'POST');
        })
    },
    info: async (key) => {
        return self.get(key, 'getMe').then(res => {
            if (res.ok) return res.result;

            var msg = 'Telegram bot API key'
            msg += ' [Code: ' + res.error_code + ' / ' + res.description + ']';
            die(msg);
        });
    },
    bind: async (key, url) => {
        if (!url) die('No Telegram bot url to bind to');

        var info = await self.info(key);
        var res = await self.post(key, {
            method: 'setWebhook', url: url + '?bot=' + key
        })
        if (res.ok) return info;
        else die(res.description);
    },
    fork: (key) => {
        return self.bind({key, url: self.server.info.url});
    },
    debug: (title, obj) => {
        if (!self.server.DEBUG) return;
        var out = [ title, exp(obj) ];
        console.log(...out);    // eslint-disable-line no-console

        function exp(o) {
            return (o && o.isObj)
                ? njsutil.inspect(obj, {depth: null})
                : obj;
        }
    },
    err: (e, label = 'ERROR') => {
        e = njsutil.inspect(e, {depth: null});
        console.error(label, e);   // eslint-disable-line no-console
    }
}

function die(s) {
    throw new Error(s);
}