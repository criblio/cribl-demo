exports.name = 'Publish Metrics';
exports.version = '0.1';
exports.group = 'Advanced';

const cLogger = C.util.getLogger('func:publish_metrics');

let _metricsConf = { values: [], nameExpr: [], types: [], dims: [] };
let overwrite = false;
exports.init = (opts) => {
  _metricsConf = { values: [], nameExpr: [], types: [], dims: [] };

  const conf = opts.conf || {};
  if (conf.fields) {
    for (let i = 0; i < conf.fields.length; i++) {
      const curEntry = conf.fields[i];
      if (curEntry && curEntry.inFieldName && curEntry.metricType) {
        _metricsConf.values.push(curEntry.inFieldName.trim());
        _metricsConf.nameExpr.push(curEntry.outFieldExpr); // push undefined here instead of an expression
        _metricsConf.types.push(curEntry.metricType);
      }
    }
  }

  if (_metricsConf.values.length === 0) {
    // Something went wrong, no metrics values to extract
    _metricsConf = undefined;
    return;
  }

  // Optional list of dimensions to extract from event and include with each statistic.
  if (conf.dimensions) {
    _metricsConf.dims = (conf.dimensions || []).map(d => d.trim());
  } else {
    // Remove dims from conf so attribute is not present (event if undefined).
    // Helpful for unit testing to remove.
    delete _metricsConf.dims;
  }
  overwrite = Boolean(conf.overwrite);
  cLogger.info('Using config: ', { overwrite, _metricsConf });
};

exports.unload = () => {
  _metricsConf = undefined;
};

exports.process = (event) => {
  if (_metricsConf === undefined) {
    return event;
  }

  if (event.__criblMetrics && Array.isArray(event.__criblMetrics) && !overwrite) {
    // Add metrics meta-data to array.
    event.__criblMetrics.push(_metricsConf);
  } else {
    // Metrics meta-data not found on the event, add it.
    event.__criblMetrics = [_metricsConf];
  }
  return event;
};
