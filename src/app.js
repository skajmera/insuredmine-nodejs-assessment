const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
require('./models');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');
const { getCpuUsagePercent } = require('./utils/cpuUsage');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid });
});

app.get('/health/cpu', async (req, res) => {
  const usage = await getCpuUsagePercent(500);
  res.json({ cpuUsagePercent: Number(usage.toFixed(2)) });
});

app.use('/api', apiLimiter, routes);

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
