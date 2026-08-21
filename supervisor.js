const { fork } = require('child_process');
const path = require('path');
const logger = require('./src/utils/logger');
const { cpu: cpuConfig } = require('./src/config/env');
const { getCpuUsagePercent } = require('./src/utils/cpuUsage');

const SERVER_ENTRY = path.resolve(__dirname, 'src/server.js');

let child = null;
let consecutiveHighSamples = 0;
let restarting = false;

function startChild() {
  child = fork(SERVER_ENTRY);
  consecutiveHighSamples = 0;

  child.on('exit', (code, signal) => {
    logger.warn(`Server process exited (code=${code}, signal=${signal})`);
    if (!restarting) {
      logger.info('Unexpected exit, restarting server');
      startChild();
    }
    restarting = false;
  });

  logger.info(`Server process started (pid ${child.pid})`);
}

function restartChild() {
  if (restarting || !child) return;
  restarting = true;

  logger.warn(
    `CPU usage stayed above ${cpuConfig.thresholdPercent}% for ${cpuConfig.sustainedSamples} checks, restarting server (pid ${child.pid})`
  );

  const dyingChild = child;
  dyingChild.once('exit', () => startChild());
  dyingChild.kill('SIGTERM');

  setTimeout(() => {
    if (!dyingChild.killed) dyingChild.kill('SIGKILL');
  }, 5000);
}

async function monitorLoop() {
  const usage = await getCpuUsagePercent(1000);

  if (usage >= cpuConfig.thresholdPercent) {
    consecutiveHighSamples += 1;
    logger.warn(`CPU usage ${usage.toFixed(1)}% (${consecutiveHighSamples}/${cpuConfig.sustainedSamples} high samples)`);
  } else {
    consecutiveHighSamples = 0;
  }

  if (consecutiveHighSamples >= cpuConfig.sustainedSamples) {
    restartChild();
    consecutiveHighSamples = 0;
  }

  setTimeout(monitorLoop, cpuConfig.checkIntervalMs);
}

startChild();
monitorLoop();

process.on('SIGINT', () => {
  logger.info('Supervisor shutting down');
  if (child) child.kill('SIGTERM');
  process.exit(0);
});
