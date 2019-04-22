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
        var state = meta.dialogue;
        if (msg.cmd) {
            state.route = msg.cmd;
            state.rsp = [];
        }

        var step = steps[state.rsp.length];
        opts = Object.assign({fields: step, throwPrefix: state.route}, opts)
		var val = await self.parse(msg, opts);
		state.rsp.push({nm: step.nm, val});

		if (step.post) {
            let post = await step.post(val, state.rsp);
            if (post) val = post;
        }

        // the last step in the dialogue has been reached
        // so we clear state as an indication to caller

        if (steps.length == state.rsp.length) meta.dialogue = undefined;

        // if no messages provided it's up to the caller
        // to generate them

        if (!opts.MSG) return {nm: step.nm, val};

        var ret = opts.MSG[step.nm.uc()];
        if (!ret) die('No message for step [' + step.nm + ']');
        if (typeof ret == 'string') ret = { 
            text: ret, vars: val.isObj ? val : state.rsp.last()
        };
        if (val.choices) ret.choices = val.choices;
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
            ret = ret.then(() => self.post(key, Object.assign({}, msg, msgs[i])));
        }
        return ret;

        function objs(o) {
            return typeof o == 'string' ? {text: o} : o;
        }
        function splitter(o) {
            var r = o.text.split(/^\s*---/m);
            return r.map(x => Object.assign({}, o, {text: x.heredoc()}));
        }
        function vars(o) {
            if (o.vars) o.text = o.text.sprintf(o.vars)
            return o;
        }
        function keyboards(o) {
            if (o.choices) msg.keyboard(o.choices)
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
            else die({msg, res});
            return res;
        })
        .catch(e => {
            if (e.code == 'ECONNRESET')
                return self.post(key, msg);
            self.err(e, 'POST');
        })
    },
    info: async (key) => {
        return self.get(key, 'getMe');
    },
    bind: (info) => {
        if (!info.url) die('No Telegram bot url to bind to');
        Object.assign(self.server.info, info);

        var bot;
        return self.info(info.key).then(res => {
            if (res.ok) bot = res.result;
            else {
                var msg = 'Telegram bot API key'
                msg += ' [Code: ' + res.error_code + ' / ' + res.description + ']';
                die(msg);
            }
            return self.post(info.key, {
                method: 'setWebhook',
                url: info.url + '?bot=' + bot.username
            })
        })
        .then(res => {
            if (!res.ok) die(res.description);
            return bot;
        })
    },
    fork: (key) => {
        return self.bind({key, url: self.server.info.url});
    },
    debug: (title, obj) => {
        if (!self.server.DEBUG) return;
        var out = [title];
        if (obj && obj.isObj) out.push(njsutil.inspect(obj, {depth: null}));
        console.log(...out);    // eslint-disable-line no-console
    },
    err: (e, label = 'ERROR') => {
        e = njsutil.inspect(e, {depth: null});
        console.error(label, e);   // eslint-disable-line no-console
    }
}

function die(s) {
    throw new Error(s);
}