exports.name = 'Publish Metrics';
exports.version = '0.2';
exports.group = 'Advanced';

const cLogger = C.util.getLogger('func:publish_metrics');

let _metricsConf;
let _metricsToRemoveConf;
let _dimensionsToAddConf;
let _dimensionsToRemoveConf;
let overwrite = false;
exports.init = (opts) => {
  _metricsConf = undefined;
  _metricsToRemoveConf = undefined;
  _dimensionsToAddConf = undefined;
  _dimensionsToRemoveConf = undefined;

  const conf = opts.conf || {};
  // metrics to add
  if (conf.fields) {
    _metricsConf = { values: [], nameExpr: [], types: [] };
    for (const curEntry of conf.fields) {
      if (curEntry && curEntry.inFieldName && curEntry.metricType) {
        _metricsConf.values.push(curEntry.inFieldName.trim());
        curEntry.outFieldExpr = (curEntry.outFieldExpr) ? curEntry.outFieldExpr.trim() : undefined; 
        _metricsConf.nameExpr.push(curEntry.outFieldExpr); // push undefined here instead of an expression
        _metricsConf.types.push(curEntry.metricType);
      } 
    }
    _metricsConf = _metricsConf.values.length ? _metricsConf : undefined;
  }
  overwrite = Boolean(conf.overwrite);

  // metrics to remove
  _metricsToRemoveConf = parseConf(conf.removeMetrics, (values) => new C.util.WildcardList(Array.from(values)));

  // dimensions to add
  _dimensionsToAddConf = parseConf(conf.dimensions, (values) => Array.from(values));

  // remove dimensions
  _dimensionsToRemoveConf = parseConf(conf.removeDimensions, (values) => new C.util.WildcardList(Array.from(values)));

  cLogger.info('Using config: ', { overwrite, _metricsConf, _dimensionsToAddConf, _dimensionsToRemoveConf});
};

function parseConf(inConf, cb) {
  let outConf;
  if (inConf) {
    outConf = new Set();
    for (let val of inConf) {
      val = (val) ? val.trim() : "";
      if (val) outConf.add(val);
    }
    outConf = outConf.size ? cb(outConf) : undefined;
  }
  return outConf;
}

exports.unload = () => {
  _metricsConf = undefined;
  _metricsToRemoveConf = undefined;
  _dimensionsToAddConf = undefined;
  _dimensionsToRemoveConf = undefined;
  overwrite = false;
};

exports.process = (event) => {
  if (_metricsConf === undefined && _metricsToRemoveConf === undefined 
      && _dimensionsToAddConf === undefined && _dimensionsToRemoveConf === undefined) {
    return event;
  }

  if (_metricsConf && event.__criblMetrics && Array.isArray(event.__criblMetrics) && !overwrite) {
    // Add metrics meta-data to array.
    event.__criblMetrics.push(_metricsConf);
  } else if (_metricsConf) {
    // Metrics meta-data not found on the event, add it.
    event.__criblMetrics = [_metricsConf];
  }

  if (event.__criblMetrics && (_metricsToRemoveConf || _dimensionsToAddConf || _dimensionsToRemoveConf)) {
    const metricsToKeep = [];
    // go through all the metrics and update/remove properly
    for (let x = 0; x < event.__criblMetrics.length; x++) {
      let metric = event.__criblMetrics[x];
      let metricCopy = { values: [], nameExpr: [], types: [] }
      for (let y = 0; y < metric.values.length; y++) {
        // check whether the current metric has to be removed or kept
        if (!_metricsToRemoveConf || !_metricsToRemoveConf.test(metric.values[y])) {
          metricCopy.nameExpr.push(metric.nameExpr[y]);
          metricCopy.values.push(metric.values[y]);
          metricCopy.types.push(metric.types[y]);
        }
      }
      
      if (!metricCopy.nameExpr.length)
        // removed metric
        continue;
      
      let dimsCopy = [...(metric.dims || [])];
      // add new dimensions to existing metrics
      if (_dimensionsToAddConf) {
        if (overwrite)
          dimsCopy = [..._dimensionsToAddConf]
        else
          dimsCopy = Array.from(new Set([...dimsCopy, ..._dimensionsToAddConf]));
      }

      // remove dimensions from existing metrics
      if (_dimensionsToRemoveConf && dimsCopy.length)
        dimsCopy = dimsCopy.filter(d => !_dimensionsToRemoveConf.test(d));

      const { dims, values, nameExpr, types, __metricAccessor, ...rest } = metric;
      // ...rest will include other properties already existing
      metricCopy = { ...metricCopy, ...rest };
      if (dimsCopy.length) metricCopy.dims = dimsCopy;

      metricsToKeep.push(metricCopy);
    }
    event.__criblMetrics = metricsToKeep.length ? metricsToKeep : undefined;
  }
  return event;
};
