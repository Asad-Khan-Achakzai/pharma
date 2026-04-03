const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Ledger = require('../models/Ledger');
const DistributorInventory = require('../models/DistributorInventory');
const DoctorActivity = require('../models/DoctorActivity');
const MedRepTarget = require('../models/MedRepTarget');
const Order = require('../models/Order');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');
const { roundPKR } = require('../utils/currency');

const objectId = (id) => new mongoose.Types.ObjectId(id);

const nd = { $ne: true };

const dashboard = async (companyId) => {
  const cid = objectId(companyId);
  const [salesAgg, expenseAgg, orderCounts, paymentAgg, outstandingAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: { companyId: cid, type: 'SALE', isDeleted: nd } },
      { $group: { _id: null, totalRevenue: { $sum: '$revenue' }, totalProfit: { $sum: '$profit' } } }
    ]),
    Transaction.aggregate([
      { $match: { companyId: cid, type: 'EXPENSE', isDeleted: nd } },
      { $group: { _id: null, totalExpenses: { $sum: '$cost' } } }
    ]),
    Order.aggregate([
      { $match: { companyId: cid, isDeleted: nd } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: { companyId: cid, isDeleted: nd } },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } }
    ]),
    Ledger.aggregate([
      { $match: { companyId: cid, entityType: 'PHARMACY', isDeleted: nd } },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: { $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0] } },
          totalCredit: { $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0] } }
        }
      }
    ])
  ]);

  const sales = salesAgg[0] || { totalRevenue: 0, totalProfit: 0 };
  const expenses = expenseAgg[0] || { totalExpenses: 0 };
  const paid = paymentAgg[0] || { totalPaid: 0 };
  const outstanding = outstandingAgg[0] || { totalDebit: 0, totalCredit: 0 };

  const netProfit = await Transaction.aggregate([
    { $match: { companyId: cid, isDeleted: nd } },
    { $group: { _id: null, net: { $sum: '$profit' } } }
  ]);

  const orderStatusMap = {};
  orderCounts.forEach((o) => { orderStatusMap[o._id] = o.count; });

  return {
    totalSales: roundPKR(sales.totalRevenue),
    grossProfit: roundPKR(sales.totalProfit),
    totalExpenses: roundPKR(expenses.totalExpenses),
    netProfit: roundPKR(netProfit[0]?.net || 0),
    totalPaid: roundPKR(paid.totalPaid),
    totalOutstanding: roundPKR(outstanding.totalDebit - outstanding.totalCredit),
    ordersByStatus: orderStatusMap
  };
};

const sales = async (companyId, from, to) => {
  const match = { companyId: objectId(companyId), type: 'SALE', isDeleted: nd };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }
  return Transaction.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, revenue: { $sum: '$revenue' }, cost: { $sum: '$cost' }, profit: { $sum: '$profit' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
};

const profit = async (companyId, from, to) => {
  const match = { companyId: objectId(companyId), isDeleted: nd };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }
  const result = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        revenue: { $sum: '$revenue' },
        cost: { $sum: '$cost' },
        profit: { $sum: '$profit' }
      }
    }
  ]);

  const map = {};
  result.forEach((r) => { map[r._id] = r; });

  const grossProfit = roundPKR((map.SALE?.profit || 0) + (map.RETURN?.profit || 0));
  const netProfit = roundPKR(result.reduce((s, r) => s + r.profit, 0));

  return { grossProfit, netProfit, breakdown: result };
};

const expenses = async (companyId, from, to) => {
  const match = { companyId: objectId(companyId), isDeleted: nd };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }
  return Expense.aggregate([
    { $match: match },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);
};

const inventoryValuation = async (companyId) => {
  return DistributorInventory.aggregate([
    { $match: { companyId: objectId(companyId), isDeleted: nd } },
    {
      $lookup: { from: 'distributors', localField: 'distributorId', foreignField: '_id', as: 'distributor' }
    },
    { $unwind: '$distributor' },
    {
      $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$distributorId',
        distributorName: { $first: '$distributor.name' },
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalValue: { $sum: { $multiply: ['$quantity', '$avgCostPerUnit'] } }
      }
    },
    { $sort: { totalValue: -1 } }
  ]);
};

const doctorROI = async (companyId) => {
  return DoctorActivity.aggregate([
    { $match: { companyId: objectId(companyId), isDeleted: nd } },
    {
      $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'doctor' }
    },
    { $unwind: '$doctor' },
    {
      $project: {
        doctorName: '$doctor.name', specialization: '$doctor.specialization',
        investedAmount: 1, expectedSales: 1, achievedSales: 1,
        roi: { $cond: [{ $gt: ['$investedAmount', 0] }, { $multiply: [{ $divide: ['$achievedSales', '$investedAmount'] }, 100] }, 0] },
        period: 1
      }
    },
    { $sort: { roi: -1 } }
  ]);
};

const repPerformance = async (companyId) => {
  return MedRepTarget.aggregate([
    { $match: { companyId: objectId(companyId), isDeleted: nd } },
    {
      $lookup: { from: 'users', localField: 'medicalRepId', foreignField: '_id', as: 'rep' }
    },
    { $unwind: '$rep' },
    {
      $project: {
        repName: '$rep.name', month: 1,
        salesTarget: 1, achievedSales: 1, packsTarget: 1, achievedPacks: 1,
        salesPercent: { $cond: [{ $gt: ['$salesTarget', 0] }, { $multiply: [{ $divide: ['$achievedSales', '$salesTarget'] }, 100] }, 0] },
        packsPercent: { $cond: [{ $gt: ['$packsTarget', 0] }, { $multiply: [{ $divide: ['$achievedPacks', '$packsTarget'] }, 100] }, 0] }
      }
    },
    { $sort: { month: -1 } }
  ]);
};

const outstanding = async (companyId) => {
  return Ledger.aggregate([
    { $match: { companyId: objectId(companyId), entityType: 'PHARMACY', isDeleted: nd } },
    {
      $group: {
        _id: '$entityId',
        totalDebit: { $sum: { $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0] } },
        totalCredit: { $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0] } }
      }
    },
    { $addFields: { outstanding: { $subtract: ['$totalDebit', '$totalCredit'] } } },
    { $match: { outstanding: { $gt: 0 } } },
    {
      $lookup: { from: 'pharmacies', localField: '_id', foreignField: '_id', as: 'pharmacy' }
    },
    { $unwind: '$pharmacy' },
    { $project: { pharmacyName: '$pharmacy.name', city: '$pharmacy.city', totalDebit: 1, totalCredit: 1, outstanding: 1 } },
    { $sort: { outstanding: -1 } }
  ]);
};

const cashFlow = async (companyId, from, to) => {
  const match = { companyId: objectId(companyId), isDeleted: nd };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  const [inflow, outflow] = await Promise.all([
    Payment.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  return { inflow, outflow };
};

module.exports = { dashboard, sales, profit, expenses, inventoryValuation, doctorROI, repPerformance, outstanding, cashFlow };
