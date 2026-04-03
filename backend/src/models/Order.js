const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../constants/enums');
const { softDeletePlugin } = require('../plugins/softDelete');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    quantity: { type: Number, required: true },
    deliveredQty: { type: Number, default: 0 },
    returnedQty: { type: Number, default: 0 },
    tpAtTime: { type: Number, required: true },
    castingAtTime: { type: Number, required: true },
    distributorDiscount: { type: Number, default: 0 },
    clinicDiscount: { type: Number, default: 0 }
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    orderNumber: { type: String, unique: true },
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor', required: true },
    medicalRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING
    },
    totalOrderedAmount: { type: Number, default: 0 },
    notes: { type: String }
  },
  { timestamps: true }
);

orderSchema.index({ companyId: 1, status: 1 });
orderSchema.index({ companyId: 1, pharmacyId: 1 });
orderSchema.index({ companyId: 1, distributorId: 1 });
orderSchema.index({ companyId: 1, medicalRepId: 1 });
orderSchema.index({ companyId: 1, createdAt: -1 });

orderSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Order', orderSchema);
