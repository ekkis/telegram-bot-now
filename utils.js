// convenience transform functions

var xf = {
    uc: (s) => { return s.toUpperCase() },
    lc: (s) => { return s.toLowerCase() },
    tc: (s) => { 
        return s.toLowerCase()
            .replace(/(^|\s)\S/g, t => t.toUpperCase());
    },
    n: (s) => { return parseFloat(s) },
}

// prototype methods

Array.prototype.unique = function() { 
    return this.filter((e, pos) => this.indexOf(e) == pos);
}

if (!Array.prototype.flat) // polyfill for older versions of NodeJs that don't support this
	Array.prototype.flat = function() {
		var r = (ret, v) => ret.concat(Array.isArray(v) ? v.flat() : v);
		return this.reduce(r, []);
	}

String.prototype.sprintf = function(o) {
	var s = this.toString();
	if (typeof o != 'object') return s;
	for (var k in o)
		s = s.replace(new RegExp('%{' + k + '}', 'g'), o[k]);
	return s;
};

String.prototype.trimln = function(s) {
	return this.trim()
		.replace(/^[ \t]*/gm, '')
		.replace(/([^\n])\n/g, '$1 ');
};

// utilities

module.exports = {
    parse: (s, desc) => {
        var m = s;
        if (typeof s == 'object') s = s.args;
        if (desc.clean) {
            var rep = '';
            if (Array.isArray(desc.clean)) {
                desc.clean = new RegExp('\\s*(' + desc.clean.join('|') + ')\\s*', 'ig');
                rep = ' ';
            }
            s = s.replace(desc.clean, rep);
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
                    : (f.valid instanceof RegExp) ? r[i].match(f.valid)
                    : false;
                if (!ok) {
                    let msg = f.throw;
                    if (desc.throwPrefix) 
                        msg = desc.throwPrefix + f.nm.toUpperCase() + '_ERR';
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
    html: {
        table: (ths, trs) => {
            for (var i in trs) {
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
            let rem = "";
            for (var ln of fn) {
                if (ln.match(/\s*\/\//))
                    rem += ln.replace("//", "").trim();
                else if (rem) {
                    ret.push("/" + k + " " + rem);
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
        var r = s.replace(/.*\?/, '').split(/[&=]/);
        for (var i = 0; i < r.length; i += 2) {
            ret[r[i]] = r[i+1];
        }   
        return ret;
    }
}
