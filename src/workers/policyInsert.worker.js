const { parentPort, workerData } = require('worker_threads');
const { mongoose } = require('../config/database');
const { connectDB } = require('../config/database');
const Policy = require('../models/Policy');

const { rows, maps, mongoUri } = workerData;

function parseDate(value) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function run() {
  await connectDB(mongoUri);

  const ops = [];
  let skipped = 0;

  rows.forEach((row) => {
    const categoryId = maps.categoryIdByName[row.categoryName];
    const companyId = maps.carrierIdByName[row.companyName];
    const userId = maps.userIdByEmail[row.email];

    if (!categoryId || !companyId || !userId) {
      skipped += 1;
      return;
    }

    ops.push({
      updateOne: {
        filter: { policyNumber: row.policyNumber },
        update: {
          $setOnInsert: {
            policyNumber: row.policyNumber,
            startDate: parseDate(row.startDate),
            endDate: parseDate(row.endDate),
            premiumAmount: row.premiumAmount,
            categoryId: new mongoose.Types.ObjectId(categoryId),
            companyId: new mongoose.Types.ObjectId(companyId),
            userId: new mongoose.Types.ObjectId(userId),
          },
        },
        upsert: true,
      },
    });
  });

  let inserted = 0;
  if (ops.length) {
    const result = await Policy.bulkWrite(ops, { ordered: false });
    inserted = result.upsertedCount || 0;
  }

  parentPort.postMessage({
    ok: true,
    processed: rows.length,
    inserted,
    skipped,
  });
}

run().catch((err) => {
  parentPort.postMessage({ ok: false, error: err.message });
});
