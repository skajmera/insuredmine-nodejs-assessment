const app = require('./app');
const { connectDB } = require('./config/database');
const { startScheduler } = require('./services/scheduler.service');
const { port, mongoUri } = require('./config/env');
const logger = require('./utils/logger');

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled rejection: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

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
  logger.error(`Failed to start server: ${err.message}`);
  logger.error(`Check that MongoDB is reachable at ${mongoUri}`);
  process.exit(1);
});
