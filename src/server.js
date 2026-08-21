const app = require('./app');
const { connectDB } = require('./config/database');
const { startScheduler } = require('./services/scheduler.service');
const { port } = require('./config/env');
const logger = require('./utils/logger');

async function bootstrap() {
  await connectDB();
  await startScheduler();

  const server = app.listen(port, () => {
    logger.info(`Server running on port ${port} (pid ${process.pid})`);
    if (process.send) {
      process.send('ready');
    }
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server gracefully');
    server.close(() => process.exit(0));
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', err.message);
  process.exit(1);
});
