const mongoose = require('mongoose');
const Order = require('../models/Order');
const DeliveryRecord = require('../models/DeliveryRecord');
const ReturnRecord = require('../models/ReturnRecord');
const DistributorInventory = require('../models/DistributorInventory');
const doctorActivityService = require('./doctorActivity.service');
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
const { ORDER_STATUS, LEDGER_TYPE, LEDGER_REFERENCE_TYPE, TRANSACTION_TYPE, LEDGER_ENTITY_TYPE } = require('../constants/enums');
const auditService = require('./audit.service');
const pdfService = require('./pdf.service');
const financialService = require('./financial.service');

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
      distributorDiscount: item.distributorDiscount ?? distributor.discountOnTP ?? 0,
      clinicDiscount: item.clinicDiscount ?? pharmacy.discountOnTP ?? 0
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
    .populate('distributorId', 'name city discountOnTP commissionPercentOnTP')
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

  if (data.pharmacyId !== undefined) {
    const pharmacy = await Pharmacy.findOne({ _id: data.pharmacyId, companyId, isActive: true });
    if (!pharmacy) throw new ApiError(404, 'Pharmacy not found');
    order.pharmacyId = data.pharmacyId;
  }
  if (data.distributorId !== undefined) {
    const distributor = await Distributor.findOne({ _id: data.distributorId, companyId, isActive: true });
    if (!distributor) throw new ApiError(404, 'Distributor not found');
    order.distributorId = data.distributorId;
  }
  if (data.doctorId !== undefined) {
    order.doctorId = data.doctorId && String(data.doctorId).trim() ? data.doctorId : null;
  }
  if (data.notes !== undefined) order.notes = data.notes;
  if (data.items) {
    const [pharmacy, distributor] = await Promise.all([
      Pharmacy.findOne({ _id: order.pharmacyId, companyId }),
      Distributor.findOne({ _id: order.distributorId, companyId })
    ]);
    const productIds = data.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds }, companyId, isActive: true });
    const productMap = {};
    products.forEach((p) => { productMap[p._id.toString()] = p; });

    order.items = data.items.map((item) => {
      const product = productMap[item.productId];
      if (!product) throw new ApiError(400, `Product ${item.productId} not found`);
      return {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        deliveredQty: 0,
        returnedQty: 0,
        tpAtTime: product.tp,
        castingAtTime: product.casting,
        distributorDiscount: item.distributorDiscount ?? distributor?.discountOnTP ?? 0,
        clinicDiscount: item.clinicDiscount ?? pharmacy?.discountOnTP ?? 0
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

    const distributor = await Distributor.findOne({ _id: order.distributorId, companyId }).session(session);
    if (!distributor) throw new ApiError(404, 'Distributor not found');

    const deliveryRecordItems = [];
    let totalAmount = 0;
    let totalCost = 0;
    let totalPacks = 0;
    let tpSubtotal = 0;
    let distributorShareTotal = 0;
    let companyShareTotal = 0;
    let commissionPctSnapshot = null;

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

      const snap = financialService.computeLineSnapshot(orderItem, dItem.quantity, distributor);
      commissionPctSnapshot = snap.commissionPct;

      const avgCostAtTime = inv.avgCostPerUnit;
      const finalSellingPrice = snap.finalSellingPrice;
      const profitPerUnit = roundPKR(finalSellingPrice - avgCostAtTime);
      const totalProfit = roundPKR(profitPerUnit * dItem.quantity);

      await DistributorInventory.updateOne(
        { _id: inv._id },
        { $inc: { quantity: -dItem.quantity }, $set: { lastUpdated: new Date() } },
        { session }
      );

      orderItem.deliveredQty += dItem.quantity;

      deliveryRecordItems.push({
        productId: dItem.productId,
        quantity: dItem.quantity,
        avgCostAtTime,
        finalSellingPrice,
        profitPerUnit,
        totalProfit,
        tpLineTotal: snap.tpLineTotal,
        distributorShare: snap.distributorShare,
        linePharmacyNet: snap.linePharmacyNet,
        companyShare: snap.companyShare
      });

      const lineNet = snap.linePharmacyNet;
      totalAmount += lineNet;
      tpSubtotal += snap.tpLineTotal;
      distributorShareTotal += snap.distributorShare;
      companyShareTotal += snap.companyShare;
      totalCost += roundPKR(avgCostAtTime * dItem.quantity);
      totalPacks += dItem.quantity;
    }

    totalAmount = roundPKR(totalAmount);
    tpSubtotal = roundPKR(tpSubtotal);
    distributorShareTotal = roundPKR(distributorShareTotal);
    companyShareTotal = roundPKR(companyShareTotal);

    const totalProfit = roundPKR(totalAmount - totalCost);

    const allDelivered = order.items.every((i) => i.deliveredQty >= i.quantity);
    order.status = allDelivered ? ORDER_STATUS.DELIVERED : ORDER_STATUS.PARTIALLY_DELIVERED;
    order.updatedBy = reqUser.userId;
    await order.save({ session });

    const invoiceNumber = await generateOrderNumber(DeliveryRecord, companyId, 'INV');

    const pharmacyNetPayable = totalAmount;
    const [delivery] = await DeliveryRecord.create(
      [
        {
          companyId,
          orderId,
          invoiceNumber,
          items: deliveryRecordItems,
          totalAmount,
          totalCost,
          totalProfit,
          tpSubtotal,
          distributorShareTotal,
          pharmacyNetPayable,
          companyShareTotal,
          distributorCommissionPercent: commissionPctSnapshot,
          deliveredBy: reqUser.userId
        }
      ],
      { session, ordered: true }
    );

    if (order.doctorId && tpSubtotal > 0) {
      await doctorActivityService.applyDeliveryTp(session, companyId, {
        doctorId: order.doctorId,
        tpAmount: tpSubtotal,
        deliveredAt: delivery.deliveredAt
      });
    }

    const month = new Date().toISOString().slice(0, 7);
    await MedRepTarget.updateOne(
      { companyId, medicalRepId: order.medicalRepId, month },
      { $inc: { achievedSales: totalAmount, achievedPacks: totalPacks } },
      { session }
    );

    await financialService.postDeliveryLedgers(session, {
      companyId,
      pharmacyId: order.pharmacyId,
      deliveryId: delivery._id,
      orderId: order._id,
      invoiceNumber,
      pharmacyNetPayable,
      date: new Date()
    });

    await Transaction.create(
      [{ companyId, type: TRANSACTION_TYPE.SALE, referenceType: 'DELIVERY', referenceId: delivery._id, revenue: totalAmount, cost: totalCost, profit: totalProfit, date: new Date(), description: `Sale - ${invoiceNumber}` }],
      { session, ordered: true }
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
    let tpReturnTotal = 0;

    for (const rItem of returnItems) {
      const orderItem = order.items.find((i) => i.productId.toString() === rItem.productId);
      if (!orderItem) throw new ApiError(400, `Product ${rItem.productId} not in this order`);

      const returnable = orderItem.deliveredQty - orderItem.returnedQty;
      if (rItem.quantity > returnable) {
        throw new ApiError(400, `Cannot return ${rItem.quantity} of ${orderItem.productName}. Returnable: ${returnable}`);
      }

      const lastDelivery = await DeliveryRecord.findOne(
        { companyId, orderId, 'items.productId': rItem.productId }
      )
        .sort({ deliveredAt: -1 })
        .session(session);

      const dLine = lastDelivery?.items?.find((i) => i.productId.toString() === rItem.productId);
      const avgCostAtTime = dLine?.avgCostAtTime || 0;
      const finalSellingPrice = dLine?.finalSellingPrice || 0;
      const profitPerUnit = roundPKR(finalSellingPrice - avgCostAtTime);
      const totalProfit = roundPKR(profitPerUnit * rItem.quantity);

      await DistributorInventory.updateOne(
        { companyId, distributorId: order.distributorId, productId: rItem.productId },
        { $inc: { quantity: rItem.quantity }, $set: { lastUpdated: new Date() } },
        { session }
      );

      orderItem.returnedQty += rItem.quantity;

      const returnLineAmount = roundPKR(finalSellingPrice * rItem.quantity);

      returnRecordItems.push({
        productId: rItem.productId,
        quantity: rItem.quantity,
        avgCostAtTime,
        finalSellingPrice,
        profitPerUnit,
        totalProfit,
        reason: rItem.reason || ''
      });
      totalAmount += returnLineAmount;
      totalCost += roundPKR(avgCostAtTime * rItem.quantity);
      totalPacks += rItem.quantity;
      tpReturnTotal += roundPKR(orderItem.tpAtTime * rItem.quantity);
    }

    tpReturnTotal = roundPKR(tpReturnTotal);

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
      [{ companyId, orderId, items: returnRecordItems, totalAmount, totalCost, totalProfit, returnedBy: reqUser.userId }],
      { session, ordered: true }
    );

    if (order.doctorId && tpReturnTotal > 0) {
      await doctorActivityService.applyReturnTp(session, companyId, {
        doctorId: order.doctorId,
        tpAmount: tpReturnTotal,
        returnedAt: returnRecord.returnedAt
      });
    }

    const month = new Date().toISOString().slice(0, 7);
    await MedRepTarget.updateOne(
      { companyId, medicalRepId: order.medicalRepId, month },
      { $inc: { achievedSales: -totalAmount, achievedPacks: -totalPacks } },
      { session }
    );

    const retDate = new Date();
    await Ledger.create(
      [{ companyId, entityType: LEDGER_ENTITY_TYPE.PHARMACY, entityId: order.pharmacyId, type: LEDGER_TYPE.CREDIT, amount: totalAmount, referenceType: LEDGER_REFERENCE_TYPE.RETURN, referenceId: returnRecord._id, description: `Return for order ${order.orderNumber}`, date: retDate }],
      { session, ordered: true }
    );

    for (const row of returnRecordItems) {
      const returnLineAmount = roundPKR(row.finalSellingPrice * row.quantity);
      const lastDelivery = await DeliveryRecord.findOne({
        companyId,
        orderId,
        'items.productId': row.productId
      })
        .sort({ deliveredAt: -1 })
        .session(session);
      if (!lastDelivery) continue;
      const line = lastDelivery.items.find((i) => i.productId.toString() === row.productId.toString());
      if (!line) continue;
      const linePharmacyNet = roundPKR(line.linePharmacyNet ?? line.finalSellingPrice * line.quantity);
      if (linePharmacyNet <= 0) continue;
      const f = Math.min(1, returnLineAmount / linePharmacyNet);
      const lineCompany = line.companyShare != null ? roundPKR(line.companyShare) : roundPKR(linePharmacyNet - (line.distributorShare || 0));
      const lineDist = line.distributorShare != null ? roundPKR(line.distributorShare) : 0;
      await financialService.postReturnClearingAdjustment(session, {
        companyId,
        distributorId: order.distributorId,
        deliveryId: lastDelivery._id,
        orderId: order._id,
        fraction: f,
        companyShareTotal: lineCompany,
        distributorShareTotal: lineDist,
        returnRecordId: returnRecord._id,
        date: retDate
      });
    }

    await Transaction.create(
      [{ companyId, type: TRANSACTION_TYPE.RETURN, referenceType: 'RETURN', referenceId: returnRecord._id, revenue: -totalAmount, cost: -totalCost, profit: -totalProfit, date: new Date(), description: `Return - ${order.orderNumber}` }],
      { session, ordered: true }
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
