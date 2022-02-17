exports.disabled = 0;
exports.name = 'Redis';
exports.group = 'Standard';
exports.version = 0.1;

const url = require('url');

const cLogger = C.util.getLogger('func:redis');
const { Expression, NestedPropertyAccessor } = C.expr;

let commands = [];           // array of: {keyExpr: Expression, command: Function, outField?: NestedPropertyAccessor, argsExpr?: Expression}
let client;                  // redis client 
let readyClientProm;         // wait on this promise for redis client to be ready or errored
let waitForReconnect = true; // whether to wait for client to reconnect on every event 
let waitForReconnectTimeout; // timeout which when expired and client is still disconnected sets waitForReconnect=false
let conf;
let redactedUrl;

exports.unload = () => {
  client && client.quit();
  client = undefined;
  readyClientProm = undefined;
  waitForReconnect = true;
  clearTimeout(waitForReconnectTimeout);
  waitForReconnectTimeout = undefined;
  commands = [];
}

function getCredentials(parsedUrl) {
  if (conf.authType === 'manual') {
    return {
      user: conf.username,
      password: conf.password
    };
  } else if(conf.authType === 'credentialsSecret') {
    return {
      user: conf.credentialsUsername,
      password: conf.credentialsPassword
    };
  } else if(conf.authType === 'textSecret') {
    return {
      password: conf.textPassword
    }
  } else {
    return {
      user: parsedUrl.user || undefined,
      password: parsedUrl.password || undefined
    };
  }
}

function getClient() {
  if(readyClientProm) return readyClientProm;
  readyClientProm = new Promise((resolve, reject) => {
    const onReady = () => {
      cLogger.info('connected', {url: redactedUrl});
      client.removeListener('end', onEnd);
      resolve(client);
    };
    const onEnd = () => {
      cLogger.info('disconnected, will retry to reconnect', {url: redactedUrl});
      readyClientProm = undefined;
      client && client.removeListener('ready', onReady);
      reject(new Error('disconnected from redis server'));
    }
    client.once('ready', onReady);
    client.once('end', onEnd);
  });
  return readyClientProm;
}

exports.init = (opt) => {
  conf = (opt || {}).conf || {};
  const { Redis } = C.internal;

  commands = (conf.commands || []).map(cmd => {
    const {command, keyExpr, argsExpr, outField} = cmd;
    if(Redis.RedisClient && !Redis.RedisClient.prototype[command]) {
      throw new Error(`unsupported redis operation=${operation}`);
    }
    if(!keyExpr) throw new Error('keyExpr is a required command argument');
    return {
      command, // made into a function later
      keyExpr: new Expression(keyExpr, { disallowAssign: true }),
      argsExpr: argsExpr && new Expression(argsExpr, { disallowAssign: true }),
      outField: outField && new NestedPropertyAccessor(outField),
    };
  });

  redactedUrl = redactUrl(conf.url);
  const parsedUrl = parseUrl(conf.url);

  const maxBlockSecs = (conf.maxBlockSecs || 0) * 1000;
  cLogger.info('connecting', {url: redactedUrl});
  const tls = parsedUrl.url.startsWith('rediss://') ? {rejectUnauthorized: false} : undefined; // allow for self-signed certs
  client = Redis.createClient({
    url: parsedUrl.url,
    enable_offline_queue: false,
    string_numbers: false,
    tls,
    ...(getCredentials(parsedUrl)),
    retry_strategy: function(options) {
      return options.attempt > 7 ? 10000 :
        Math.min(Math.pow(2, options.attempt-1) * 100, 10000);
    }
  });

  // if client is disconnected for a "long" period of time - assume it's down and pass 
  // events thru, while attempting to periodically reconnect to redis in the background 
  client.on('ready', () => {waitForReconnect = true;});
  client.on('end', () => {
    clearTimeout(waitForReconnectTimeout);
    cLogger.info('disconnected, will retry to reconnect', {url: redactedUrl});
    readyClientProm = undefined;
    waitForReconnectTimeout = maxBlockSecs === 0 || client == null ? undefined : setTimeout(() => {
      if(!client || client.ready) return; // noop, client has been reconnected since or unloaded
      cLogger.warn('redis connection unavailable for too long, passing events thru')
      waitForReconnect = false;
    }, maxBlockSecs)
  });
  client.on('reconnecting', opts => cLogger.info('reconnecting', {url: redactedUrl, ...opts}));
  client.on('error', error => cLogger.error('redis client error', {error}));
  getClient().catch(()=>{}); // init readyClientProm
};

function redactUrl(url) {
  return url.replace(/(rediss?:\/\/)([^@]+?@)(.+)/, (match, group1, group2, group3) => {
    return `${group1}...@${group3}`;
  })
}

function parseUrl(sourceUrl) {
  const parsedUrl = new url.URL(sourceUrl);
  const user = parsedUrl.username;
  const password = parsedUrl.password;
  [parsedUrl.username, parsedUrl.password] = ['', ''];
  return {
    url: parsedUrl.toString(),
    // Redis URLs are a little funny.  Only one auth part == password instead of user
    user: password ? user : undefined,
    password: password || user
  };
}

exports.process = (event) => {
  if(!event) return event;
  if(commands.length == 0) return event; // noop
  if(!client) return event;
 
  let clientProm;
  if(client.ready) {
    clientProm = Promise.resolve(client);
  } else if(waitForReconnect) {
    clientProm = getClient();
  } else {
    event.__redisError = 'redis connection unavailable';
    return event;
  }

  // make request to redis, await response and add result
  return clientProm
    .then(async (client) => {
      const batch = client.batch();
      for(const cmd of commands) {
        const key = cmd.keyExpr.evalOn(event);
        if(key == null) continue; // no key to run a command on

        const args = [key];
        if(cmd.argsExpr) {
          const extraArgs = cmd.argsExpr.evalOn(event);
          if(extraArgs) {
            if(Array.isArray(extraArgs)) args.push(...extraArgs)
            else                         args.push(extraArgs);
          }
        }
        batch[cmd.command](args, (err, res) => {
          if(err) return; //TODO: how do we recrod that this commad failed?
          cmd.outField && cmd.outField.set(event, res);
        });
      }
      
      await new Promise((resolve, reject) => {
        batch.exec((err, res) => {
          if(err) return reject(err);
          resolve(res);
        });
      });
    })
    // make sure to catch all redis errors, otherwise the event might get dropped - no good!
    .catch(err => {
      event.__redisError = err.message;
    })
    .then(() => event);
};

exports.UT_getClient = getClient;
exports.UT_setWaitForReconnect = (val) => {waitForReconnect = val;}
exports.UT_getWaitForReconnectTimeout = () => {return waitForReconnectTimeout;}
