const DoctorActivity = require('../models/DoctorActivity');
const Doctor = require('../models/Doctor');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');
const { roundPKR } = require('../utils/currency');
const auditService = require('./audit.service');

const list = async (companyId, query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { companyId };
  if (query.doctorId) filter.doctorId = query.doctorId;
  const [docs, total] = await Promise.all([
    DoctorActivity.find(filter).populate('doctorId', 'name specialization').sort(sort).skip(skip).limit(limit),
    DoctorActivity.countDocuments(filter)
  ]);
  return { docs, total, page, limit };
};

const create = async (companyId, data, reqUser) => {
  const doctor = await Doctor.findOne({ _id: data.doctorId, companyId, isActive: true });
  if (!doctor) throw new ApiError(404, 'Doctor not found');

  const activity = await DoctorActivity.create({ ...data, companyId, createdBy: reqUser.userId });
  await auditService.log({ companyId, userId: reqUser.userId, action: 'doctorActivity.create', entityType: 'DoctorActivity', entityId: activity._id, changes: { after: activity.toObject() } });
  return activity;
};

const update = async (companyId, id, data, reqUser) => {
  const activity = await DoctorActivity.findOne({ _id: id, companyId });
  if (!activity) throw new ApiError(404, 'Doctor activity not found');
  const before = activity.toObject();
  if (data.investedAmount !== undefined) activity.investedAmount = data.investedAmount;
  if (data.expectedSales !== undefined) activity.expectedSales = data.expectedSales;
  if (data.period) activity.period = data.period;

  if (activity.investedAmount > 0) {
    activity.roi = roundPKR((activity.achievedSales / activity.investedAmount) * 100);
  }
  activity.updatedBy = reqUser.userId;
  await activity.save();
  await auditService.log({ companyId, userId: reqUser.userId, action: 'doctorActivity.update', entityType: 'DoctorActivity', entityId: activity._id, changes: { before, after: activity.toObject() } });
  return activity;
};

const getByDoctor = async (companyId, doctorId) => {
  return DoctorActivity.find({ companyId, doctorId }).populate('doctorId', 'name').sort({ 'period.startDate': -1 });
};

module.exports = { list, create, update, getByDoctor };
