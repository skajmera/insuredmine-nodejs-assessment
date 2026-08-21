require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/insuredmine_assessment',

  cpu: {
    checkIntervalMs: Number(process.env.CPU_CHECK_INTERVAL_MS) || 5000,
    thresholdPercent: Number(process.env.CPU_THRESHOLD_PERCENT) || 70,
    sustainedSamples: Number(process.env.CPU_SUSTAINED_SAMPLES) || 3,
  },

  upload: {
    chunkSize: Number(process.env.UPLOAD_CHUNK_SIZE) || 500,
    workerPoolSize: Number(process.env.UPLOAD_WORKER_POOL_SIZE) || 4,
  },
};
