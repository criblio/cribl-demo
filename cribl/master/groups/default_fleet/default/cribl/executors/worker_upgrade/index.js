exports.jobType = 'task-per-node';
exports.name = 'worker_upgrade';

const os = require('os');

let upgradeClient;
let packages;
let authToken;

const {
  internal: { UpgradeClient, performPackageDownload },
} = C;

exports.initJob = async (opts) => {
  const { conf } = opts.conf.executor;
  
  await Promise.all(conf.packages.map( async (each) => {
    const { packageFile, packageUrl, hashUrl, hashFile, hashType } = each;
    await performPackageDownload(packageUrl, packageFile, hashUrl, hashFile, hashType);
  }))

  packages = conf.packages;
  authToken = conf.authToken;
};
exports.jobSeedTask = async () => {
  return {
    task: {
      packages,
      authToken,
    },
  };
};
exports.initTask = async (opts) => {
  upgradeClient = new UpgradeClient();
};

exports.jobOnError = async (job, taskId, error) => {}; 

exports.taskExecute = async (job, opts) => {

  const logger = job.logger();
  const variant = [os.platform(), os.arch()];
  const package = opts.packages.find((p) => p.variant[0] === variant[0] && p.variant[1] === variant[1]);

  if(!package) {
    job.reportError(new Error(`Could not find a suitable package for ${variant.join(', ')}`), 'TASK_FATAL');
    return;
  }

  const descriptor = {
    packageUrl: package.localPackageUrl,
    hashUrl: package.localHashUrl,
    version: package.version,
  };
  logger.info('task opts', { opts });
  logger.info('Checking upgradability', { ...descriptor });
  let upgradeResult;
  upgradeResult = await upgradeClient.checkUpgradePath(descriptor, job.logger());
  if (!upgradeResult.canUpgrade) {
    logger.info(upgradeResult.message);
    job.addResult(upgradeResult);
    return;
  }
  logger.info('Fetching assets');
  const downloadResult = await upgradeClient.downloadAssets(descriptor, opts.authToken);
  logger.info('Fetched assets', downloadResult);
  if (descriptor.hashUrl) {
    logger.info('Verifying assets');
    await upgradeClient.verifyAssets(downloadResult);
    logger.info('Assets verified');
  }
  logger.info('Proceeding to installation');
  upgradeResult = await upgradeClient.installPackage(downloadResult, upgradeResult);
  logger.info(upgradeResult.message);
  if (!upgradeResult.isSuccess) {
    job.reportError(new Error(upgradeResult.message), 'TASK_FATAL');
    return;
  }
  await job.addResult(upgradeResult);
  setImmediate(() => upgradeClient.restartServer().catch(() => {}));
};
