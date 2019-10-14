const { Expression } = C.expr;
const cLogger = C.util.getLogger('func:suppress');

exports.name = 'Suppress';
exports.version = '0.1';
exports.disabled = false;
exports.group = 'Standard';

// Used to track suppression state to know when data is allowed to flow for a particular key.
//
// Format of data:
// {
//   'key1' : {'count': 1,'expirationTime': 11111111 },
//   'key2' : {'count': 5,'expressionTime': 22222222 }
//   ...
// }
let _primaryCache = new Map();
// Secondary cache used backs primary cache and tracks entries accessed during previous time period.
let _secondaryCache = new Map();

// Configuration parameters
let _expression = null;
let _numToAllow;
let _suppressionMs;
let _dropEvents = true;

// Number of events received used to trigger cache idle timeout.
let _numEventsReceived = 0;

// Cache cleanUp parameters.
let _cacheExpirationMs;
let _maxCacheSize;
let _cacheCleanupNumEvents;

function getCacheEntry(key, eventTime) {
  // First, look in the primary cache which stores most recent accessed objects.
  let item = _primaryCache.get(key);
  if (!item) {
    // Item not found in primary, look in secondary.
    item = _secondaryCache.get(key);
    if (item) {
      // Found item in secondary, make sure a copy exists in primary.
      _primaryCache.set(key, item);
    } else {
      // Not found in primary or secondary, add new entry to primary
      const expirationTime = eventTime + _suppressionMs;
      item = { count: 0, expirationTime };
      _primaryCache.set(key, item);
    }
  }
  return item;
}

function cleanCache() {
  // Rotate cache which allows unused cache entries to be ejected when no longer in use.
  _secondaryCache = _primaryCache;
  _primaryCache = new Map();
}

exports.init = (opts) => {
  const conf = opts.conf;
  const expressionVal = conf.keyExpr || '';
  _numToAllow = conf.allow || 1;
  _suppressionMs = Number(conf.suppressPeriodSec * 1000) || (300 * 1000);
  _maxCacheSize = conf.maxCacheSize || 50000;
  _cacheCleanupNumEvents = conf.numEventsIdleTimeoutTrigger || 100000;
  const cacheCleanUpSuppressionPeriods = conf.cacheIdleTimeoutPeriods || 2;
  _cacheExpirationMs = _suppressionMs * Number(cacheCleanUpSuppressionPeriods);

  _dropEvents = conf.dropEventsMode === undefined || Boolean(conf.dropEventsMode);

  if (expressionVal.length > 0) {
    _expression = new Expression(expressionVal, { disallowAssign: true });
  }
  _primaryCache = new Map();
  _secondaryCache = new Map();
  _numEventsReceived = 0;
  cLogger.info('initialized suppress function', { keyExpr: expressionVal, numToAllow: _numToAllow, dropEventsMode: _dropEvents,
    supressionMs: _suppressionMs, cacheExpirationMs: _cacheExpirationMs, maxCacheSize: _maxCacheSize,
    cacheCleanupNumEvents: _cacheCleanupNumEvents });
};

exports.process = (event) => {
  if (!_expression || !event) {
    if (event) {
      event.suppress = 0;
    }
    return event;
  }

  const key = _expression.evalOn(event);
  if (key === undefined || key === null) {
    // Something wrong, expression returned empty key... Return event unmodified.
    event.suppress = 0;
    return event;
  }
  _numEventsReceived++;

  // Periodically clean-up cache when event threshold reached and cache is large.
  if (((_numEventsReceived % _cacheCleanupNumEvents) === 0) && _primaryCache.size >= _maxCacheSize) {
    cleanCache();
  }
  const eventTime = (C.util.getEventTimeInMs(event) || Date.now());
  const suppressionData = getCacheEntry(key, eventTime);

  if (suppressionData.count === 0) {
    // Newly created suppression, return current event unsuppressed.
    suppressionData.count = 1;
    event.suppress = 0;
    return event;
  }

  let suppressionWasExpired = false;
  const numSuppressed = (suppressionData.count > _numToAllow) ? suppressionData.count - _numToAllow : 0;
  if (eventTime > suppressionData.expirationTime) {
    // Suppression has expired, reset suppression state, will allow events to flow again
    // until _numToAllow events are returned.
    suppressionData.expirationTime = eventTime + _suppressionMs;
    suppressionData.count = 0;
    suppressionWasExpired = true;
  }

  // Allow event to pass if event count is < numToAllow
  if (suppressionData.count < _numToAllow) {
    // Event not suppressed, num received less than num allowed.
    suppressionData.count++;
    event.suppress = 0;
    if (suppressionWasExpired && numSuppressed > 0) {
      // Report numSuppressed only for first event thru
      event.suppressCount = numSuppressed;
    }
    return event;
  } // else - The event is considered suppressed

  suppressionData.count++;

  if (_dropEvents) {
    return undefined;
  }

  // DropEvents mode is disabled, add fields indicating the event would of been suppressed and total number suppressed.
  event.suppress = 1;
  event.suppressCount = numSuppressed + 1;

  return event;
};

exports.unload = () => {
  _numEventsReceived = 0;
  _primaryCache = new Map();
  _secondaryCache = new Map();
};

// For unit test
exports.getCacheSize = () => {
  return _primaryCache.size;
};
