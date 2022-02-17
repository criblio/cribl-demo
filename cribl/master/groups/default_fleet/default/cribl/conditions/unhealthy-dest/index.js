exports.name = 'Unhealthy Destination';
exports.type = 'metric';
exports.category = 'destinations';

let name;
let __workerGroup;
let timeWindow;
exports.init = (opts) => {
  const conf = opts.conf || {};
  ({
    name,
    __workerGroup,
    timeWindow
  } = conf);
  timeWindow = timeWindow || '60s';
};

exports.build = () => {
  let filter = `(_metric === 'health.outputs' && output === '${name}')`;
  let _raw = `'Destination ${name} is unhealthy'`;
  const add = [
    { name: 'output', value: `'${name}'` },
    { name: '_metric', value: "'health.outputs'" }
  ];
  if (__workerGroup) {
    filter = `${filter} && __worker_group === '${__workerGroup}'`;
    _raw = `'Destination ${name} in group ${__workerGroup} is unhealthy'`;
  }
  add.push({name: '_raw', value: _raw});

  return {
    filter,
    pipeline: {
      conf: {
        functions: [
          {
            id: 'aggregation',
            conf: {
              timeWindow,
              aggregations: [
                'perc(95, _value).as(health)'
              ],
              lagTolerance: '20s',
              idleTimeLimit: '20s',
            }
          },
          {
            id: 'drop',
            filter: 'Math.round(health) < 2',
            conf: {}
          },
          {
            id: 'eval',
            conf: {
              add
            }
          }
        ]
      }
    }
  };
};
