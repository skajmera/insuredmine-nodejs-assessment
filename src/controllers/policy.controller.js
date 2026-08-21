const { searchPoliciesByUsername, aggregatePoliciesByUser } = require('../services/policy.service');

async function search(req, res, next) {
  try {
    const { username } = req.query;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ message: 'Query param "username" is required' });
    }

    const policies = await searchPoliciesByUsername(username);
    res.json({ count: policies.length, policies });
  } catch (err) {
    next(err);
  }
}

async function aggregateByUser(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const result = await aggregatePoliciesByUser({ page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { search, aggregateByUser };
