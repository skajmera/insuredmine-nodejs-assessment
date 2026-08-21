const rateLimit = require('express-rate-limit');
const { rateLimit: rateLimitConfig } = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  limit: rateLimitConfig.apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});

const uploadLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  limit: rateLimitConfig.uploadMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many uploads from this client, please try again later' },
});

module.exports = { apiLimiter, uploadLimiter };
