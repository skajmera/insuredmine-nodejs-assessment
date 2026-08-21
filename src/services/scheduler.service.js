const Agenda = require('agenda');
const { mongoUri } = require('../config/env');
const ScheduledMessage = require('../models/ScheduledMessage');
const logger = require('../utils/logger');

const agenda = new Agenda({ db: { address: mongoUri, collection: 'agendaJobs' } });

agenda.define('insert-scheduled-message', async (job) => {
  const { message, scheduledFor } = job.attrs.data;
  await ScheduledMessage.create({ message, scheduledFor: new Date(scheduledFor) });
  logger.info(`Scheduled message inserted: "${message}" (target ${scheduledFor})`);
});

let started = false;

async function startScheduler() {
  if (started) return agenda;
  await agenda.start();
  started = true;
  logger.info('Agenda scheduler started');
  return agenda;
}

function combineDayAndTime(day, time) {
  const dateTime = new Date(`${day}T${time}`);
  if (Number.isNaN(dateTime.getTime())) {
    const err = new Error('Invalid day/time. Use day=YYYY-MM-DD and time=HH:mm (24h)');
    err.status = 400;
    throw err;
  }
  return dateTime;
}

async function scheduleMessage({ message, day, time }) {
  const scheduledFor = combineDayAndTime(day, time);
  await agenda.schedule(scheduledFor, 'insert-scheduled-message', { message, scheduledFor });
  return { message, scheduledFor };
}

module.exports = { startScheduler, scheduleMessage, agenda };
