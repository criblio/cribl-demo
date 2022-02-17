exports.name = 'Persistent Queue Usage';
exports.type = 'metric';
exports.category = 'destinations';

let name;
let __workerGroup;
let timeWindow;
let usageThreshold;
let usageThresholdDecimal;
exports.init = (opts) => {
  const conf = opts.conf || {};
  ({
    name,
    __workerGroup,
    timeWindow,
    usageThreshold
  } = conf);
  timeWindow = timeWindow || '60s';
  usageThreshold = usageThreshold != null ? usageThreshold : 90; // percentage value (0-99)
  usageThresholdDecimal = usageThreshold / 100;
};

exports.build = () => {
  let workerGroupMessage = "";
  let filter = `_metric === 'system.pq_used' && output === '${name}'`;

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
                'last(_value).as(queue_usage)'
              ],
              lagTolerance: '20s',
              idleTimeLimit: '20s',
            }
          },
          {
            id: 'drop',
            filter: `typeof queue_usage === 'undefined' || queue_usage <= ${usageThresholdDecimal}`,
            conf: {}
          },
         {
            id: 'eval',
            filter: `queue_usage > ${usageThresholdDecimal}`,
            conf: {
              add: [
                { name: 'output', value: `'${name}'` },
                { name: '_metric', value: "'system.pq_used'" },
                { name: '_raw', value: `'Persistent Queue usage has surpassed ${usageThreshold}%${workerGroupMessage}'`}
              ]
            }
          }
        ]
      }
    }
  };
};
