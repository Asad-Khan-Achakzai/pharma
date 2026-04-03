const mongoose = require('mongoose');
const DistributorInventory = require('../models/DistributorInventory');
const StockTransfer = require('../models/StockTransfer');
const Distributor = require('../models/Distributor');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const { roundPKR } = require('../utils/currency');
const { parsePagination } = require('../utils/pagination');
const auditService = require('./audit.service');

const getAll = async (companyId, query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { companyId };
  if (query.distributorId) filter.distributorId = query.distributorId;
  if (query.productId) filter.productId = query.productId;

  const [docs, total] = await Promise.all([
    DistributorInventory.find(filter)
      .populate('distributorId', 'name')
      .populate('productId', 'name composition mrp tp casting')
      .sort(sort).skip(skip).limit(limit),
    DistributorInventory.countDocuments(filter)
  ]);
  return { docs, total, page, limit };
};

const getSummary = async (companyId) => {
  const cid = new mongoose.Types.ObjectId(companyId);

  const byProduct = await DistributorInventory.aggregate([
    { $match: { companyId: cid, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: '$productId',
        totalQuantity: { $sum: '$quantity' },
        totalValue: { $sum: { $multiply: ['$quantity', '$avgCostPerUnit'] } },
        distributorCount: { $sum: 1 },
        weightedCostSum: { $sum: { $multiply: ['$quantity', '$avgCostPerUnit'] } }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: '$product.name',
        composition: '$product.composition',
        mrp: '$product.mrp',
        tp: '$product.tp',
        casting: '$product.casting',
        totalQuantity: 1,
        totalValue: { $round: ['$totalValue', 2] },
        distributorCount: 1,
        avgCostPerUnit: {
          $cond: [
            { $gt: ['$totalQuantity', 0] },
            { $round: [{ $divide: ['$weightedCostSum', '$totalQuantity'] }, 2] },
            0
          ]
        }
      }
    },
    { $sort: { productName: 1 } }
  ]);

  const totals = byProduct.reduce(
    (acc, row) => {
      acc.totalUnits += row.totalQuantity;
      acc.totalValue = roundPKR(acc.totalValue + row.totalValue);
      return acc;
    },
    { totalUnits: 0, totalValue: 0, uniqueProducts: byProduct.length }
  );

  return { byProduct, totals };
};

const getByDistributor = async (companyId, distributorId) => {
  const inventory = await DistributorInventory.find({ companyId, distributorId })
    .populate('productId', 'name composition mrp tp casting');
  return inventory;
};

const transfer = async (companyId, data, reqUser) => {
  const { distributorId, items, totalShippingCost, notes } = data;

  const distributor = await Distributor.findOne({ _id: distributorId, companyId, isActive: true });
  if (!distributor) throw new ApiError(404, 'Distributor not found');

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, companyId, isActive: true });
  if (products.length !== productIds.length) {
    throw new ApiError(400, 'One or more products not found');
  }

  const productMap = {};
  products.forEach((p) => { productMap[p._id.toString()] = p; });

  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const shippingPerUnit = totalUnits > 0 ? roundPKR((totalShippingCost || 0) / totalUnits) : 0;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transferItems = [];

    for (const item of items) {
      const product = productMap[item.productId];
      const castingAtTime = product.casting;
      const shippingCostPerUnit = shippingPerUnit;
      const newCostPerUnit = roundPKR(castingAtTime + shippingCostPerUnit);

      let inv = await DistributorInventory.findOne(
        { companyId, distributorId, productId: item.productId }
      ).session(session);

      if (inv && inv.quantity > 0) {
        const totalExistingValue = inv.quantity * inv.avgCostPerUnit;
        const totalNewValue = item.quantity * newCostPerUnit;
        inv.avgCostPerUnit = roundPKR((totalExistingValue + totalNewValue) / (inv.quantity + item.quantity));
        inv.quantity += item.quantity;
      } else if (inv) {
        inv.quantity += item.quantity;
        inv.avgCostPerUnit = newCostPerUnit;
      } else {
        inv = new DistributorInventory({
          companyId, distributorId, productId: item.productId,
          quantity: item.quantity, avgCostPerUnit: newCostPerUnit,
          createdBy: reqUser.userId
        });
      }

      inv.lastUpdated = new Date();
      inv.updatedBy = reqUser.userId;
      await inv.save({ session });

      transferItems.push({
        productId: item.productId,
        quantity: item.quantity,
        castingAtTime,
        shippingCostPerUnit
      });
    }

    const stockTransfer = await StockTransfer.create(
      [{ companyId, distributorId, items: transferItems, totalShippingCost: totalShippingCost || 0, notes, createdBy: reqUser.userId }],
      { session }
    );

    await session.commitTransaction();

    await auditService.log({ companyId, userId: reqUser.userId, action: 'inventory.transfer', entityType: 'StockTransfer', entityId: stockTransfer[0]._id, changes: { after: stockTransfer[0].toObject() } });

    return stockTransfer[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getTransfers = async (companyId, query) => {
  const { page, limit, skip, sort } = parsePagination(query);
  const filter = { companyId };
  if (query.distributorId) filter.distributorId = query.distributorId;

  const [docs, total] = await Promise.all([
    StockTransfer.find(filter)
      .populate('distributorId', 'name')
      .populate('items.productId', 'name')
      .populate('createdBy', 'name')
      .sort(sort).skip(skip).limit(limit),
    StockTransfer.countDocuments(filter)
  ]);
  return { docs, total, page, limit };
};

module.exports = { getAll, getByDistributor, transfer, getTransfers, getSummary };
