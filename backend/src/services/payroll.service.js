const Payroll = require('../models/Payroll');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');
const { PAYROLL_STATUS, TRANSACTION_TYPE, EXPENSE_CATEGORY } = require('../constants/enums');
const { roundPKR } = require('../utils/currency');
const auditService = require('./audit.service');

const list = async (companyId, query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { companyId };
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.month) filter.month = query.month;
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    Payroll.find(filter).populate('employeeId', 'name email role').sort(sort).skip(skip).limit(limit),
    Payroll.countDocuments(filter)
  ]);
  return { docs, total, page, limit };
};

const create = async (companyId, data, reqUser) => {
  const netSalary = roundPKR(data.baseSalary + (data.bonus || 0) - (data.deductions || 0));
  const payroll = await Payroll.create({ ...data, companyId, netSalary, createdBy: reqUser.userId });
  await auditService.log({ companyId, userId: reqUser.userId, action: 'payroll.create', entityType: 'Payroll', entityId: payroll._id, changes: { after: payroll.toObject() } });
  return payroll;
};

const update = async (companyId, id, data, reqUser) => {
  const payroll = await Payroll.findOne({ _id: id, companyId });
  if (!payroll) throw new ApiError(404, 'Payroll not found');
  if (payroll.status === PAYROLL_STATUS.PAID) throw new ApiError(400, 'Cannot edit paid payroll');
  const before = payroll.toObject();
  Object.assign(payroll, data);
  payroll.netSalary = roundPKR(payroll.baseSalary + payroll.bonus - payroll.deductions);
  payroll.updatedBy = reqUser.userId;
  await payroll.save();
  await auditService.log({ companyId, userId: reqUser.userId, action: 'payroll.update', entityType: 'Payroll', entityId: payroll._id, changes: { before, after: payroll.toObject() } });
  return payroll;
};

const pay = async (companyId, id, reqUser) => {
  const payroll = await Payroll.findOne({ _id: id, companyId });
  if (!payroll) throw new ApiError(404, 'Payroll not found');
  if (payroll.status === PAYROLL_STATUS.PAID) throw new ApiError(400, 'Already paid');

  payroll.status = PAYROLL_STATUS.PAID;
  payroll.paidOn = new Date();
  payroll.updatedBy = reqUser.userId;
  await payroll.save();

  const expense = await Expense.create({
    companyId,
    category: EXPENSE_CATEGORY.SALARY,
    amount: payroll.netSalary,
    description: `Salary for ${payroll.month}`,
    date: new Date(),
    employeeId: payroll.employeeId,
    approvedBy: reqUser.userId,
    createdBy: reqUser.userId
  });

  await Transaction.create({
    companyId,
    type: TRANSACTION_TYPE.EXPENSE,
    referenceType: 'PAYROLL',
    referenceId: payroll._id,
    revenue: 0,
    cost: payroll.netSalary,
    profit: roundPKR(-payroll.netSalary),
    date: new Date(),
    description: `Salary payment - ${payroll.month}`,
    createdBy: reqUser.userId
  });

  await auditService.log({ companyId, userId: reqUser.userId, action: 'payroll.pay', entityType: 'Payroll', entityId: payroll._id, changes: { after: { status: 'PAID', paidOn: payroll.paidOn, expenseId: expense._id } } });

  return payroll;
};

module.exports = { list, create, update, pay };
