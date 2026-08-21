const os = require('os');
const path = require('path');
const { upload: uploadConfig, mongoUri } = require('../config/env');
const { runWorker, runWorkerPool } = require('../workers/workerPool');
const logger = require('../utils/logger');

const MASTER_WORKER = path.resolve(__dirname, '../workers/masterData.worker.js');
const POLICY_WORKER = path.resolve(__dirname, '../workers/policyInsert.worker.js');

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function processUploadedFile(filePath) {
  const startedAt = Date.now();

  const masterResult = await runWorker(MASTER_WORKER, { filePath, mongoUri });
  if (!masterResult.ok) {
    throw new Error(`Master data extraction failed: ${masterResult.error}`);
  }

  const { rows, maps, counts } = masterResult;
  const chunks = chunk(rows, uploadConfig.chunkSize);

  const poolSize = Math.min(uploadConfig.workerPoolSize, os.cpus().length, Math.max(chunks.length, 1));
  const policyResults = await runWorkerPool(
    POLICY_WORKER,
    chunks.map((rowsChunk) => ({ rows: rowsChunk, maps, mongoUri })),
    poolSize
  );

  const failed = policyResults.find((r) => !r.ok);
  if (failed) {
    throw new Error(`Policy insertion failed: ${failed.error}`);
  }

  const policySummary = policyResults.reduce(
    (acc, r) => {
      acc.processed += r.processed;
      acc.inserted += r.inserted;
      acc.skipped += r.skipped;
      return acc;
    },
    { processed: 0, inserted: 0, skipped: 0 }
  );

  const durationMs = Date.now() - startedAt;
  logger.info(`Upload processed in ${durationMs}ms using ${poolSize} policy workers`, { counts, policySummary });

  return { masterCounts: counts, policySummary, workerPoolSize: poolSize, durationMs };
}

module.exports = { processUploadedFile };
