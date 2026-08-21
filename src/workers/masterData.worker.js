const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const XLSX = require('xlsx');
const { connectDB } = require('../config/database');
const Agent = require('../models/Agent');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Carrier = require('../models/Carrier');
const User = require('../models/User');

const { filePath, mongoUri } = workerData;

function parseDate(value) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function upsertByField(Model, field, values, extraByValue) {
  if (!values.length) return [];

  await Model.bulkWrite(
    values.map((value) => ({
      updateOne: {
        filter: { [field]: value },
        update: { $setOnInsert: { [field]: value, ...(extraByValue ? extraByValue(value) : {}) } },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  return Model.find({ [field]: { $in: values } }).lean();
}

async function run() {
  await connectDB(mongoUri);

  const agentNames = new Set();
  const accountAgentByName = new Map();
  const categoryNames = new Set();
  const carrierNames = new Set();
  const userByEmail = new Map();
  const policyRows = [];
  let totalRows = 0;

  function consumeRow(row) {
    totalRows += 1;

    const agentName = String(row.agent || '').trim();
    const accountName = String(row.account_name || '').trim();
    const email = String(row.email || '').trim().toLowerCase();
    const categoryName = String(row.category_name || '').trim();
    const companyName = String(row.company_name || '').trim();
    const policyNumber = String(row.policy_number || '').trim();

    if (agentName) agentNames.add(agentName);
    if (accountName) accountAgentByName.set(accountName, agentName || null);
    if (categoryName) categoryNames.add(categoryName);
    if (companyName) carrierNames.add(companyName);

    if (email && !userByEmail.has(email)) {
      userByEmail.set(email, {
        firstname: row.firstname,
        dob: parseDate(row.dob),
        address: row.address,
        phone: String(row.phone || ''),
        state: row.state,
        zip: String(row.zip || ''),
        gender: row.gender,
        userType: row.userType,
        accountName,
      });
    }

    if (policyNumber && email) {
      policyRows.push({
        policyNumber,
        startDate: row.policy_start_date,
        endDate: row.policy_end_date,
        premiumAmount: Number(row.premium_amount) || undefined,
        categoryName,
        companyName,
        email,
      });
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', consumeRow)
        .on('end', resolve)
        .on('error', reject);
    });
  } else {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }).forEach(consumeRow);
  }

  const agents = await upsertByField(Agent, 'name', [...agentNames]);
  const agentIdByName = new Map(agents.map((a) => [a.name, a._id.toString()]));

  const accounts = await upsertByField(
    Account,
    'accountName',
    [...accountAgentByName.keys()],
    (accountName) => {
      const agentName = accountAgentByName.get(accountName);
      return agentName ? { agentId: agentIdByName.get(agentName) } : {};
    }
  );
  const accountIdByName = new Map(accounts.map((a) => [a.accountName, a._id.toString()]));

  const categories = await upsertByField(Category, 'categoryName', [...categoryNames]);
  const categoryIdByName = new Map(categories.map((c) => [c.categoryName, c._id.toString()]));

  const carriers = await upsertByField(Carrier, 'companyName', [...carrierNames]);
  const carrierIdByName = new Map(carriers.map((c) => [c.companyName, c._id.toString()]));

  const userEmails = [...userByEmail.keys()];
  if (userEmails.length) {
    await User.bulkWrite(
      userEmails.map((email) => {
        const u = userByEmail.get(email);
        return {
          updateOne: {
            filter: { email },
            update: {
              $setOnInsert: {
                email,
                firstname: u.firstname,
                dob: u.dob,
                address: u.address,
                phone: u.phone,
                state: u.state,
                zip: u.zip,
                gender: u.gender,
                userType: u.userType,
                accountId: u.accountName ? accountIdByName.get(u.accountName) : undefined,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false }
    );
  }
  const users = await User.find({ email: { $in: userEmails } }).lean();
  const userIdByEmail = new Map(users.map((u) => [u.email, u._id.toString()]));

  parentPort.postMessage({
    ok: true,
    rows: policyRows,
    maps: {
      categoryIdByName: Object.fromEntries(categoryIdByName),
      carrierIdByName: Object.fromEntries(carrierIdByName),
      userIdByEmail: Object.fromEntries(userIdByEmail),
    },
    counts: {
      agents: agentNames.size,
      accounts: accountAgentByName.size,
      categories: categoryNames.size,
      carriers: carrierNames.size,
      users: userEmails.length,
      totalRows,
    },
  });
}

run().catch((err) => {
  parentPort.postMessage({ ok: false, error: err.message });
});
