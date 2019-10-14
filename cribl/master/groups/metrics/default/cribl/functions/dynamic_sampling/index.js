exports.name = 'Dynamic Sampling';
exports.version = '0.1';
exports.group = 'Standard';

const { Expression } = C.expr;
const cLogger = C.util.getLogger('func:dynamic_sampling');

const DEFAULT_PERIOD_SECS = 30;
const DEFAULT_MIN_EVENTS = 30;
const DEFAULT_MAX_SAMPLE_RATE = 100;
const SAMPLE_MODES = { NONE: 0, LOG: 1, SQUARE_ROOT: 2 };

// Mechanism to derive sampleRate.
let sampleMode = SAMPLE_MODES.NONE;
// Minimum number of events that must be received in sample period before sampling mode is applied.
let minEvents = DEFAULT_MIN_EVENTS;
// Max sampling rate, clamp sampleRate to this
let maxSampleRate = DEFAULT_MAX_SAMPLE_RATE;
// Expression used to derive sampleGroup names: i.e.: `${domain}_${statusCode}`
let expression;
// Used to store state for each Sample Group, content looks like:
// { "cribl.io:200" : { "sampleRate" : 100, "sampleIdx" : 1, "count" : 100,"nextUpdateTime" : 15535146530001 },
//   "cribl.io:404" : { "sampleRate" : 10, "sampleIdx" : 1, "count" : 10, "nextUpdateTime" : 1553514658123 },
//   ... }
let sampleGroupStats = {};
// Defines how often sample rates are re-calculated.
let samplePeriodMS;

exports.init = (opts) => {
  const { conf } = opts || {};
  sampleGroupStats = {};
  expression = new Expression(`${conf.keyExpr || true}`, { disallowAssign: true });
  samplePeriodMS = (conf.samplePeriod || DEFAULT_PERIOD_SECS) * 1000;
  minEvents = conf.minEvents >= 0 ? conf.minEvents : DEFAULT_MIN_EVENTS; // 0 disables test.
  maxSampleRate = Math.max(Math.floor(conf.maxSampleRate || DEFAULT_MAX_SAMPLE_RATE), 1);

  let modeStr = conf.mode;
  if (modeStr && modeStr.toLowerCase() === 'log') {
    sampleMode = SAMPLE_MODES.LOG;
  } else if (modeStr && modeStr.toLowerCase() === 'sqrt') {
    sampleMode = SAMPLE_MODES.SQUARE_ROOT;
  } else {
    // Default
    modeStr = 'log';
    sampleMode = SAMPLE_MODES.LOG;
  }

  cLogger.info('Dynamic Sampling Initialized', { mode: `${modeStr}-(${sampleMode})`, samplePeriodMS, minEvents, expression: expression.originalExpression });
};

exports.process = (event) => {
  const sampleGroup = expression.evalOn(event);
  let sampleStats = sampleGroupStats[sampleGroup];
  const curTime = (C.util.getEventTimeInMs(event) || Date.now());
  if (sampleStats === undefined) {
    // New sample group, default to sample rate to 1:1. Counts will be tracked and used to adjust sample rates during
    // sample rate re-calculation.
    sampleStats = { sampleRate: 1, count: 0, sampleIdx: 1, nextUpdateTime: (curTime + samplePeriodMS) };
    sampleGroupStats[sampleGroup] = sampleStats;
  } else if (curTime >= sampleStats.nextUpdateTime) {
    recalcSampleRate(sampleGroup, sampleStats, curTime);
  }

  sampleStats.count++;
  if (sampleStats.sampleIdx++ >= sampleStats.sampleRate) {
    sampleStats.sampleIdx = 1; // reset 1 to ensure proper counting in 1-in-N
    event.sampled = sampleStats.sampleRate;
    //cLogger.info(`Allowing event for sampleGroup: ${sampleGroup}, sample rate: ${sampleStats.sampleRate}, count: ${sampleStats.count}`);
    return event;
  }
  return undefined; // Filtered
};

function recalcSampleRate(sampleName, sampleStats, curTime) {
  if (sampleStats.count === 0) {
    // No activity during last sampling period, reset sample rate to 1.
    sampleStats.count = 0;
    sampleStats.sampleRate = 1;
  } else {
    const numPeriodsSinceLastUpdate = (curTime - sampleStats.nextUpdateTime) / samplePeriodMS;
    if (numPeriodsSinceLastUpdate >= 1) {
      // Went 1+ sample periods w/out an update, effective count is 0.
      sampleStats.count = 0;
      sampleStats.sampleRate = 1;
    } else {
      sampleStats.sampleRate = Math.min(getSampleRate(sampleStats.count), maxSampleRate); // clamp sample rate
      sampleStats.sampleIdx = 1 + Math.floor(Math.random() * sampleStats.sampleRate);
      sampleStats.count = 0;
    }
    // Reset time to update sample rate.
    sampleStats.nextUpdateTime = (curTime + samplePeriodMS);
    //cLogger.info(`Updated sample rate for sampleGroup: ${sampleName}, next UpdateTime: ${new Date(sampleStats.nextUpdateTime).toLocaleString()}, config: `, sampleStats);
  }
}

function getSampleRate(count) {
  if (!count || count <= minEvents) {
    return 1;
  }
  if (sampleMode === SAMPLE_MODES.LOG) {
    return Math.ceil(Math.log(count));
  } else if (sampleMode === SAMPLE_MODES.SQUARE_ROOT) {
    return Math.ceil(Math.sqrt(count));
  }
  return 1;
}

// For unit test
exports.getSampleMode = () => sampleMode;
exports.getExpression = () => expression;
exports.getMinEvents = () => minEvents;
exports.getSamplePeriodMS = () => samplePeriodMS;
exports.getSampleGroupStats = () => sampleGroupStats;
exports.getSampleGroupStatsSize = () => Object.keys(sampleGroupStats).length;
