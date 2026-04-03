const mongoose = require('mongoose');
const Order = require('../models/Order');
const DeliveryRecord = require('../models/DeliveryRecord');
const ReturnRecord = require('../models/ReturnRecord');
const DistributorInventory = require('../models/DistributorInventory');
const DoctorActivity = require('../models/DoctorActivity');
const MedRepTarget = require('../models/MedRepTarget');
const Ledger = require('../models/Ledger');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Distributor = require('../models/Distributor');
const Pharmacy = require('../models/Pharmacy');
const ApiError = require('../utils/ApiError');
const { roundPKR } = require('../utils/currency');
const { generateOrderNumber } = require('../utils/orderNumber');
const { parsePagination } = require('../utils/pagination');
const { ORDER_STATUS, LEDGER_TYPE, LEDGER_REFERENCE_TYPE, TRANSACTION_TYPE } = require('../constants/enums');
const auditService = require('./audit.service');
const pdfService = require('./pdf.service');

const list = async (companyId, query) => {
  const { page, limit, skip, sort, search } = parsePagination(query);
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  if (query.distributorId) filter.distributorId = query.distributorId;
  if (query.pharmacyId) filter.pharmacyId = query.pharmacyId;
  if (query.medicalRepId) filter.medicalRepId = query.medicalRepId;
  if (search) {
    filter.$or = [{ orderNumber: { $regex: search, $options: 'i' } }];
  }

  const [docs, total] = await Promise.all([
    Order.find(filter)
      .populate('pharmacyId', 'name city')
      .populate('doctorId', 'name')
      .populate('distributorId', 'name')
      .populate('medicalRepId', 'name')
      .sort(sort).skip(skip).limit(limit),
    Order.countDocuments(filter)
  ]);
  return { docs, total, page, limit };
};

const create = async (companyId, data, reqUser) => {
  const [pharmacy, distributor] = await Promise.all([
    Pharmacy.findOne({ _id: data.pharmacyId, companyId, isActive: true }),
    Distributor.findOne({ _id: data.distributorId, companyId, isActive: true })
  ]);
  if (!pharmacy) throw new ApiError(404, 'Pharmacy not found');
  if (!distributor) throw new ApiError(404, 'Distributor not found');

  const productIds = data.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, companyId, isActive: true });
  if (products.length !== productIds.length) throw new ApiError(400, 'One or more products not found');

  const productMap = {};
  products.forEach((p) => { productMap[p._id.toString()] = p; });

  const orderNumber = await generateOrderNumber(Order, companyId, 'ORD');

  const items = data.items.map((item) => {
    const product = productMap[item.productId];
    return {
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      tpAtTime: product.tp,
      castingAtTime: product.casting,
      distributorDiscount: item.distributorDiscount || distributor.discountOnTP,
      clinicDiscount: item.clinicDiscount || 0
    };
  });

  const totalOrderedAmount = roundPKR(
    items.reduce((sum, i) => sum + i.tpAtTime * i.quantity, 0)
  );

  const order = await Order.create({
    companyId, orderNumber,
    pharmacyId: data.pharmacyId,
    doctorId: data.doctorId || null,
    distributorId: data.distributorId,
    medicalRepId: reqUser.userId,
    items, totalOrderedAmount,
    notes: data.notes,
    createdBy: reqUser.userId
  });

  await auditService.log({ companyId, userId: reqUser.userId, action: 'order.create', entityType: 'Order', entityId: order._id, changes: { after: order.toObject() } });

  return order;
};

const getById = async (companyId, id) => {
  const order = await Order.findOne({ _id: id, companyId })
    .populate('pharmacyId', 'name city address phone')
    .populate('doctorId', 'name specialization')
    .populate('distributorId', 'name city discountOnTP')
    .populate('medicalRepId', 'name')
    .populate('items.productId', 'name composition');
  if (!order) throw new ApiError(404, 'Order not found');

  const [deliveries, returns] = await Promise.all([
    DeliveryRecord.find({ companyId, orderId: id }).populate('deliveredBy', 'name').sort({ deliveredAt: -1 }),
    ReturnRecord.find({ companyId, orderId: id }).populate('returnedBy', 'name').sort({ returnedAt: -1 })
  ]);

  return { ...order.toObject(), deliveries, returns };
};

const update = async (companyId, id, data, reqUser) => {
  const order = await Order.findOne({ _id: id, companyId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== ORDER_STATUS.PENDING) throw new ApiError(400, 'Only pending orders can be edited');

  const before = order.toObject();
  if (data.notes !== undefined) order.notes = data.notes;
  if (data.items) {
    const productIds = data.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds }, companyId, isActive: true });
    const productMap = {};
    products.forEach((p) => { productMap[p._id.toString()] = p; });

    order.items = data.items.map((item) => {
      const product = productMap[item.productId];
      if (!product) throw new ApiError(400, `Product ${item.productId} not found`);
      return {
        productId: item.productId, productName: product.name, quantity: item.quantity,
        tpAtTime: product.tp, castingAtTime: product.casting,
        distributorDiscount: item.distributorDiscount || 0, clinicDiscount: item.clinicDiscount || 0
      };
    });
    order.totalOrderedAmount = roundPKR(order.items.reduce((s, i) => s + i.tpAtTime * i.quantity, 0));
  }
  order.updatedBy = reqUser.userId;
  await order.save();
  await auditService.log({ companyId, userId: reqUser.userId, action: 'order.update', entityType: 'Order', entityId: order._id, changes: { before, after: order.toObject() } });
  return order;
};

const deliver = async (companyId, orderId, deliveryItems, reqUser) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ _id: orderId, companyId }).session(session);
    if (!order) throw new ApiError(404, 'Order not found');
    if (![ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_DELIVERED].includes(order.status)) {
      throw new ApiError(400, 'Order cannot be delivered in its current status');
    }

    const deliveryRecordItems = [];
    let totalAmount = 0;
    let totalCost = 0;
    let totalPacks = 0;

    for (const dItem of deliveryItems) {
      const orderItem = order.items.find((i) => i.productId.toString() === dItem.productId);
      if (!orderItem) throw new ApiError(400, `Product ${dItem.productId} not in this order`);

      const remaining = orderItem.quantity - orderItem.deliveredQty;
      if (dItem.quantity > remaining) {
        throw new ApiError(400, `Cannot deliver ${dItem.quantity} of ${orderItem.productName}. Remaining: ${remaining}`);
      }

      const inv = await DistributorInventory.findOne({ companyId, distributorId: order.distributorId, productId: dItem.productId }).session(session);
      if (!inv || inv.quantity < dItem.quantity) {
        throw new ApiError(400, `Insufficient inventory for ${orderItem.productName}`);
      }

      const avgCostAtTime = inv.avgCostPerUnit;
      const effectiveTP = orderItem.tpAtTime;
      const afterDistDiscount = roundPKR(effectiveTP * (1 - orderItem.distributorDiscount / 100));
      const finalSellingPrice = roundPKR(afterDistDiscount * (1 - orderItem.clinicDiscount / 100));
      const profitPerUnit = roundPKR(finalSellingPrice - avgCostAtTime);
      const totalProfit = roundPKR(profitPerUnit * dItem.quantity);

      await DistributorInventory.updateOne(
        { _id: inv._id },
        { $inc: { quantity: -dItem.quantity }, $set: { lastUpdated: new Date() } },
        { session }
      );

      orderItem.deliveredQty += dItem.quantity;

      deliveryRecordItems.push({
        productId: dItem.productId, quantity: dItem.quantity,
        avgCostAtTime, finalSellingPrice, profitPerUnit, totalProfit
      });

      totalAmount += roundPKR(finalSellingPrice * dItem.quantity);
      totalCost += roundPKR(avgCostAtTime * dItem.quantity);
      totalPacks += dItem.quantity;
    }

    const totalProfit = roundPKR(totalAmount - totalCost);

    const allDelivered = order.items.every((i) => i.deliveredQty >= i.quantity);
    order.status = allDelivered ? ORDER_STATUS.DELIVERED : ORDER_STATUS.PARTIALLY_DELIVERED;
    order.updatedBy = reqUser.userId;
    await order.save({ session });

    const invoiceNumber = await generateOrderNumber(DeliveryRecord, companyId, 'INV');

    const [delivery] = await DeliveryRecord.create(
      [{ companyId, orderId, invoiceNumber, items: deliveryRecordItems, totalAmount, totalCost, totalProfit, deliveredBy: reqUser.userId, createdBy: reqUser.userId }],
      { session }
    );

    if (order.doctorId) {
      await DoctorActivity.updateMany(
        { companyId, doctorId: order.doctorId, 'period.startDate': { $lte: new Date() }, 'period.endDate': { $gte: new Date() } },
        { $inc: { achievedSales: totalAmount } },
        { session }
      );
    }

    const month = new Date().toISOString().slice(0, 7);
    await MedRepTarget.updateOne(
      { companyId, medicalRepId: order.medicalRepId, month },
      { $inc: { achievedSales: totalAmount, achievedPacks: totalPacks } },
      { session }
    );

    await Ledger.create(
      [{ companyId, entityType: 'PHARMACY', entityId: order.pharmacyId, type: LEDGER_TYPE.DEBIT, amount: totalAmount, referenceType: LEDGER_REFERENCE_TYPE.ORDER, referenceId: delivery._id, description: `Delivery ${invoiceNumber}`, date: new Date(), createdBy: reqUser.userId }],
      { session }
    );

    await Transaction.create(
      [{ companyId, type: TRANSACTION_TYPE.SALE, referenceType: 'DELIVERY', referenceId: delivery._id, revenue: totalAmount, cost: totalCost, profit: totalProfit, date: new Date(), description: `Sale - ${invoiceNumber}`, createdBy: reqUser.userId }],
      { session }
    );

    await auditService.logInSession(session, { companyId, userId: reqUser.userId, action: 'order.deliver', entityType: 'Order', entityId: orderId, changes: { deliveryId: delivery._id, items: deliveryRecordItems } });

    await session.commitTransaction();

    // Generate PDF async (non-blocking)
    pdfService.generateInvoice(delivery._id).catch(() => {});

    return delivery;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const returnOrder = async (companyId, orderId, returnItems, reqUser) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findOne({ _id: orderId, companyId }).session(session);
    if (!order) throw new ApiError(404, 'Order not found');
    if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.PARTIALLY_DELIVERED, ORDER_STATUS.PARTIALLY_RETURNED].includes(order.status)) {
      throw new ApiError(400, 'Order cannot be returned in its current status');
    }

    const returnRecordItems = [];
    let totalAmount = 0;
    let totalCost = 0;
    let totalPacks = 0;

    for (const rItem of returnItems) {
      const orderItem = order.items.find((i) => i.productId.toString() === rItem.productId);
      if (!orderItem) throw new ApiError(400, `Product ${rItem.productId} not in this order`);

      const returnable = orderItem.deliveredQty - orderItem.returnedQty;
      if (rItem.quantity > returnable) {
        throw new ApiError(400, `Cannot return ${rItem.quantity} of ${orderItem.productName}. Returnable: ${returnable}`);
      }

      // Get the avgCostAtTime from the latest delivery for this product
      const lastDelivery = await DeliveryRecord.findOne(
        { companyId, orderId, 'items.productId': rItem.productId },
        { 'items.$': 1 }
      ).sort({ deliveredAt: -1 }).session(session);

      const avgCostAtTime = lastDelivery?.items?.[0]?.avgCostAtTime || 0;
      const finalSellingPrice = lastDelivery?.items?.[0]?.finalSellingPrice || 0;
      const profitPerUnit = roundPKR(finalSellingPrice - avgCostAtTime);
      const totalProfit = roundPKR(profitPerUnit * rItem.quantity);

      await DistributorInventory.updateOne(
        { companyId, distributorId: order.distributorId, productId: rItem.productId },
        { $inc: { quantity: rItem.quantity }, $set: { lastUpdated: new Date() } },
        { session }
      );

      orderItem.returnedQty += rItem.quantity;

      returnRecordItems.push({
        productId: rItem.productId, quantity: rItem.quantity,
        avgCostAtTime, finalSellingPrice, profitPerUnit, totalProfit,
        reason: rItem.reason || ''
      });

      totalAmount += roundPKR(finalSellingPrice * rItem.quantity);
      totalCost += roundPKR(avgCostAtTime * rItem.quantity);
      totalPacks += rItem.quantity;
    }

    const totalProfit = roundPKR(totalAmount - totalCost);

    const allReturned = order.items.every((i) => i.returnedQty >= i.deliveredQty);
    if (allReturned) {
      order.status = ORDER_STATUS.RETURNED;
    } else {
      const anyReturned = order.items.some((i) => i.returnedQty > 0);
      order.status = anyReturned ? ORDER_STATUS.PARTIALLY_RETURNED : order.status;
    }
    order.updatedBy = reqUser.userId;
    await order.save({ session });

    const [returnRecord] = await ReturnRecord.create(
      [{ companyId, orderId, items: returnRecordItems, totalAmount, totalCost, totalProfit, returnedBy: reqUser.userId, createdBy: reqUser.userId }],
      { session }
    );

    if (order.doctorId) {
      await DoctorActivity.updateMany(
        { companyId, doctorId: order.doctorId, 'period.startDate': { $lte: new Date() }, 'period.endDate': { $gte: new Date() } },
        { $inc: { achievedSales: -totalAmount } },
        { session }
      );
    }

    const month = new Date().toISOString().slice(0, 7);
    await MedRepTarget.updateOne(
      { companyId, medicalRepId: order.medicalRepId, month },
      { $inc: { achievedSales: -totalAmount, achievedPacks: -totalPacks } },
      { session }
    );

    await Ledger.create(
      [{ companyId, entityType: 'PHARMACY', entityId: order.pharmacyId, type: LEDGER_TYPE.CREDIT, amount: totalAmount, referenceType: LEDGER_REFERENCE_TYPE.RETURN, referenceId: returnRecord._id, description: `Return for order ${order.orderNumber}`, date: new Date(), createdBy: reqUser.userId }],
      { session }
    );

    await Transaction.create(
      [{ companyId, type: TRANSACTION_TYPE.RETURN, referenceType: 'RETURN', referenceId: returnRecord._id, revenue: -totalAmount, cost: -totalCost, profit: -totalProfit, date: new Date(), description: `Return - ${order.orderNumber}`, createdBy: reqUser.userId }],
      { session }
    );

    await auditService.logInSession(session, { companyId, userId: reqUser.userId, action: 'order.return', entityType: 'Order', entityId: orderId, changes: { returnId: returnRecord._id, items: returnRecordItems } });

    await session.commitTransaction();
    return returnRecord;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const cancel = async (companyId, id, reqUser) => {
  const order = await Order.findOne({ _id: id, companyId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== ORDER_STATUS.PENDING) throw new ApiError(400, 'Only pending orders can be cancelled');
  order.status = ORDER_STATUS.CANCELLED;
  order.updatedBy = reqUser.userId;
  await order.save();
  await auditService.log({ companyId, userId: reqUser.userId, action: 'order.cancel', entityType: 'Order', entityId: order._id, changes: { after: { status: 'CANCELLED' } } });
  return order;
};

module.exports = { list, create, getById, update, deliver, returnOrder, cancel };
