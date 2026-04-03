const WeeklyPlan = require('../models/WeeklyPlan');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');
const auditService = require('./audit.service');

const list = async (companyId, query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { companyId };
  if (query.medicalRepId) filter.medicalRepId = query.medicalRepId;
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    WeeklyPlan.find(filter).populate('medicalRepId', 'name').sort(sort).skip(skip).limit(limit),
    WeeklyPlan.countDocuments(filter)
  ]);
  return { docs, total, page, limit };
};

const create = async (companyId, data, reqUser) => {
  const plan = await WeeklyPlan.create({ ...data, companyId, medicalRepId: data.medicalRepId || reqUser.userId, createdBy: reqUser.userId });
  await auditService.log({ companyId, userId: reqUser.userId, action: 'weeklyPlan.create', entityType: 'WeeklyPlan', entityId: plan._id, changes: { after: plan.toObject() } });
  return plan;
};

const update = async (companyId, id, data, reqUser) => {
  const plan = await WeeklyPlan.findOne({ _id: id, companyId });
  if (!plan) throw new ApiError(404, 'Weekly plan not found');
  const before = plan.toObject();
  Object.assign(plan, data);
  plan.updatedBy = reqUser.userId;
  await plan.save();
  await auditService.log({ companyId, userId: reqUser.userId, action: 'weeklyPlan.update', entityType: 'WeeklyPlan', entityId: plan._id, changes: { before, after: plan.toObject() } });
  return plan;
};

const getByRep = async (companyId, repId) => {
  return WeeklyPlan.find({ companyId, medicalRepId: repId }).sort({ weekStartDate: -1 });
};

module.exports = { list, create, update, getByRep };
