const Payment = require('../models/Payment');
const Ledger = require('../models/Ledger');
const Pharmacy = require('../models/Pharmacy');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');
const { LEDGER_TYPE, LEDGER_REFERENCE_TYPE } = require('../constants/enums');
const auditService = require('./audit.service');

const list = async (companyId, query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { companyId };
  if (query.pharmacyId) filter.pharmacyId = query.pharmacyId;
  if (query.collectedBy) filter.collectedBy = query.collectedBy;

  const [docs, total] = await Promise.all([
    Payment.find(filter)
      .populate('pharmacyId', 'name city')
      .populate('collectedBy', 'name')
      .sort(sort).skip(skip).limit(limit),
    Payment.countDocuments(filter)
  ]);
  return { docs, total, page, limit };
};

const create = async (companyId, data, reqUser) => {
  const pharmacy = await Pharmacy.findOne({ _id: data.pharmacyId, companyId });
  if (!pharmacy) throw new ApiError(404, 'Pharmacy not found');

  const payment = await Payment.create({
    ...data,
    companyId,
    collectedBy: data.collectedBy || reqUser.userId,
    createdBy: reqUser.userId
  });

  await Ledger.create({
    companyId,
    entityType: 'PHARMACY',
    entityId: data.pharmacyId,
    type: LEDGER_TYPE.CREDIT,
    amount: data.amount,
    referenceType: LEDGER_REFERENCE_TYPE.PAYMENT,
    referenceId: payment._id,
    description: `Payment received - ${data.paymentMethod}`,
    date: data.date || new Date(),
    createdBy: reqUser.userId
  });

  await auditService.log({ companyId, userId: reqUser.userId, action: 'payment.create', entityType: 'Payment', entityId: payment._id, changes: { after: payment.toObject() } });

  return payment;
};

const getById = async (companyId, id) => {
  const payment = await Payment.findOne({ _id: id, companyId })
    .populate('pharmacyId', 'name city address')
    .populate('collectedBy', 'name');
  if (!payment) throw new ApiError(404, 'Payment not found');
  return payment;
};

const getByPharmacy = async (companyId, pharmacyId) => {
  return Payment.find({ companyId, pharmacyId })
    .populate('collectedBy', 'name')
    .sort({ date: -1 });
};

module.exports = { list, create, getById, getByPharmacy };
