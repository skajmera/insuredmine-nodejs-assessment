const os = require('os');
const { Worker } = require('worker_threads');

function runWorker(workerPath, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData });
    let settled = false;

    worker.on('message', (msg) => {
      settled = true;
      resolve(msg);
    });

    worker.on('error', (err) => {
      if (!settled) reject(err);
    });

    worker.on('exit', (code) => {
      if (!settled && code !== 0) {
        reject(new Error(`Worker at ${workerPath} exited with code ${code}`));
      }
    });
  });
}

async function runWorkerPool(workerPath, tasks, poolSize = os.cpus().length) {
  const results = new Array(tasks.length);
  let cursor = 0;

  async function drain() {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await runWorker(workerPath, tasks[index]);
    }
  }

  const size = Math.max(1, Math.min(poolSize, tasks.length));
  await Promise.all(Array.from({ length: size }, drain));

  return results;
}

module.exports = { runWorker, runWorkerPool };
