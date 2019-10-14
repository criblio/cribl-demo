exports.name = 'Auto Timestamp';
exports.version = '1.2';
exports.cribl_version = '1.6.0';
exports.disabled = false;
exports.group = 'Standard';

const { Expression, NestedPropertyAccessor } = C.expr;
const { NamedGroupRegExp } = C.util; 
const cLogger = C.util.getLogger('func:auto_timestamp');

let conf = {};
let parser;
let lastEventTime;
let srcOffset;
let srcEnd;

exports.init = (opts) => {
  conf = Object.assign({}, (opts || {}).conf || {});
  conf.maxLen = conf.maxLen || 150;
  conf.timestamps = conf.timestamps || []; // Timestamps in [{regex, strptime}] format
  conf.srcField = new NestedPropertyAccessor(conf.srcField || '_raw'); // Field to search for timestamp
  conf.dstField = new NestedPropertyAccessor(conf.dstField || '_time'); // Field to store time value in
  const timeExpression = conf.timeExpression || 'time.getTime() / 1000'; // JS Expression to take time and format it
  const useUTC = conf.defaultTimezone === 'utc';
  conf.timeExpression = new Expression(timeExpression, { disallowAssign: true });
  conf.timestamps = (conf.timestamps || []).map(t => {
    return {
      regex: new NamedGroupRegExp(t.regex),
      parser: useUTC ? C.Time.utcParse(t.strptime) : C.Time.timeParse(t.strptime)
    };
  });
  parser = C.Time.timestampFinder(useUTC);
  lastEventTime = undefined;
  conf.defaultTime = conf.defaultTime || 'now';
  srcOffset = conf.offset || 0;
  srcEnd = srcOffset + conf.maxLen;
};

exports.process = (e) => {
  let raw = conf.srcField.get(e);
  raw = raw && raw.toString().substring(srcOffset, srcEnd);
  let parsedTS;
  // see if there are custom regex/strptime to be applied first
  for (let i = 0; raw && i < conf.timestamps.length; i++) {
    const m = conf.timestamps[i].regex.exec(raw);
    if (m && m[1]) {
      parsedTS = parser.setMissingDateInfo(conf.timestamps[i].parser(m[1]));
      // console.log(parsedTS);
      if (parsedTS) {
        break;
      }
    }
  }
  parsedTS = parsedTS || (raw && parser.find(raw));
  if(parsedTS) {
    lastEventTime = parsedTS;
    conf.dstField.set(e, conf.timeExpression.evalOn({ time: parsedTS }));
  } else if(conf.defaultTime === 'last' && lastEventTime) {
    conf.dstField.set(e, conf.timeExpression.evalOn({ time: lastEventTime }));
  } else if(conf.defaultTime === 'now') {
    conf.dstField.set(e, conf.timeExpression.evalOn({ time: new Date()}));
  }
  return e;
};
