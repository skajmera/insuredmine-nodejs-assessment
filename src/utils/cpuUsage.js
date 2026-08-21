const os = require('os');

function snapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  cpus.forEach((cpu) => {
    Object.values(cpu.times).forEach((value) => {
      total += value;
    });
    idle += cpu.times.idle;
  });

  return { idle, total };
}

function getCpuUsagePercent(sampleMs = 1000) {
  const start = snapshot();

  return new Promise((resolve) => {
    setTimeout(() => {
      const end = snapshot();
      const idleDelta = end.idle - start.idle;
      const totalDelta = end.total - start.total;
      const usage = totalDelta === 0 ? 0 : 100 - (100 * idleDelta) / totalDelta;
      resolve(usage);
    }, sampleMs);
  });
}

module.exports = { getCpuUsagePercent };
