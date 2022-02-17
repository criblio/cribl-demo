exports.name = 'Destination Backpressure Activated';
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
  let workerGroupMessage = "";
  let filter = `_metric === 'backpressure.outputs' && output === '${name}'`;

  if (__workerGroup) {
    filter = `${filter} && __worker_group === '${__workerGroup}'`;
    workerGroupMessage = ` in group ${__workerGroup}`;
  }

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
                'max(_value).as(backpressure_type)'
              ],
              lagTolerance: '20s',
              idleTimeLimit: '20s',
            }
          },
          {
            id: 'drop',
            filter: "(typeof backpressure_type === 'undefined' || backpressure_type === 0)",
            conf: {}
          },
          {
            id: 'eval',
            filter: 'backpressure_type === 1', // BackpressureStatus.BLOCKING
            conf: {
              add: [
                { name: 'output', value: `'${name}'` },
                { name: '_metric', value: "'backpressure.outputs'" },
                { name: '_raw', value: `'Backpressure (blocking) is engaged for destination ${name}${workerGroupMessage}'`}
              ]
            }
          },
          {
            id: 'eval',
            filter: 'backpressure_type === 2', // BackpressureStatus.DROPPING
            conf: {
              add: [
                { name: 'output', value: `'${name}'` },
                { name: '_metric', value: "'backpressure.outputs'" },
                { name: '_raw', value: `'Backpressure (dropping) is engaged for destination ${name}${workerGroupMessage}'`}
              ]
            }
          }
        ]
      }
    }
  };
};
