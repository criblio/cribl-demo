exports.name = 'Rollup Metrics';
exports.version = '0.1';
exports.group = 'Advanced';
exports.handleSignals = true;

const { Expression, NestedPropertyAccessor } = C.expr;
const cLogger = C.util.getLogger('func:rollup_metrics');

let dimFilter;
let timeWindow;
let rollup;
let nextFlushTime;

exports.init = (opts) => {
  const conf = opts.conf || {};
  timeWindow = C.util.parseTimeStringToSeconds(conf.timeWindow || '60s');

  const dims = (conf.dimensions || []).map(x => x.trim()).filter(x => x.length);
  if(dims.length === 0) dims.push('*');

  if(dims.length === 1 && dims[0] === '*') {
    dimFilter = undefined; // everything
  } else {
    const dimsWL = new C.util.WildcardList(dims);
    dimFilter = dimsWL.test.bind(dimsWL);
  }

  rollup = new C.internal.MetricsRollup(conf.gaugeRollup, dimFilter);
  nextFlushTime = Date.now() + timeWindow*1000;
};


exports.process = (event) => {
  const signal = event.__signalEvent__;
  if(['close', 'final'].includes(signal) || Date.now() > nextFlushTime) {
    nextFlushTime += timeWindow*1000;
    const isMetric = rollup.add(event);
    const result =  rollup.output();
    if (!isMetric) result.push(event); // don't eat non-metric events when flushing
    return (result.length === 1) ? result[0] : result;
  }
  if(signal) return event; // unhandled signal, just pass it thru

  if(rollup.add(event)) return undefined; // eat up the metric
  return event; // everything else passes thru
};

exports.unload = () => {};

