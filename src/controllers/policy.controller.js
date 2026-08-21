const { searchPoliciesByUsername, aggregatePoliciesByUser } = require('../services/policy.service');

async function search(req, res, next) {
  try {
    const { username } = req.query;
    if (!username) {
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
    const result = await aggregatePoliciesByUser();
    res.json({ count: result.length, users: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, aggregateByUser };
