const express = require('express');
const morgan = require('morgan');
require('./models');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { getCpuUsagePercent } = require('./utils/cpuUsage');

const app = express();

app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid });
});

app.get('/health/cpu', async (req, res) => {
  const usage = await getCpuUsagePercent(500);
  res.json({ cpuUsagePercent: Number(usage.toFixed(2)) });
});

app.use('/api', routes);

app.use(errorHandler);

module.exports = app;
