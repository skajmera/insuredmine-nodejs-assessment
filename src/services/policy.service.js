const User = require('../models/User');
const Policy = require('../models/Policy');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function searchPoliciesByUsername(username) {
  const prefix = escapeRegex(username.toLowerCase());
  const users = await User.find({
    firstnameLower: new RegExp(`^${prefix}`),
  }).lean();

  if (!users.length) return [];

  const userIds = users.map((u) => u._id);

  return Policy.find({ userId: { $in: userIds } })
    .populate('categoryId', 'categoryName')
    .populate('companyId', 'companyName')
    .populate('userId', 'firstname email')
    .sort({ startDate: -1 })
    .lean();
}

async function aggregatePoliciesByUser({ page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;

  const [result] = await Policy.aggregate([
    {
      $group: {
        _id: '$userId',
        policyCount: { $sum: 1 },
        totalPremium: { $sum: { $ifNull: ['$premiumAmount', 0] } },
        policies: {
          $push: {
            policyNumber: '$policyNumber',
            startDate: '$startDate',
            endDate: '$endDate',
            categoryId: '$categoryId',
            companyId: '$companyId',
          },
        },
      },
    },
    {
      $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        firstname: '$user.firstname',
        email: '$user.email',
        policyCount: 1,
        totalPremium: 1,
        policies: 1,
      },
    },
    { $sort: { policyCount: -1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }],
      },
    },
  ]);

  return {
    users: result.data,
    total: result.totalCount[0]?.count || 0,
    page,
    limit,
  };
}

module.exports = { searchPoliciesByUsername, aggregatePoliciesByUser };
