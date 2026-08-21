const levels = ['error', 'warn', 'info', 'debug'];

function timestamp() {
  return new Date().toISOString();
}

function build(level) {
  return (...args) => {
    const line = `[${timestamp()}] [${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(line, ...args);
    } else {
      console.log(line, ...args);
    }
  };
}

const logger = {};
levels.forEach((level) => {
  logger[level] = build(level);
});

module.exports = logger;
