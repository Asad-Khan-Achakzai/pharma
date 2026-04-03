const mongoose = require('mongoose');
const { softDeletePlugin } = require('../plugins/softDelete');

const deliveryItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    avgCostAtTime: { type: Number },
    finalSellingPrice: { type: Number },
    profitPerUnit: { type: Number },
    totalProfit: { type: Number }
  },
  { _id: false }
);

const deliveryRecordSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    invoiceNumber: { type: String },
    items: [deliveryItemSchema],
    totalAmount: { type: Number },
    totalCost: { type: Number },
    totalProfit: { type: Number },
    deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveredAt: { type: Date, default: Date.now },
    pdfUrl: { type: String }
  },
  { timestamps: true }
);

deliveryRecordSchema.index({ companyId: 1, orderId: 1 });
deliveryRecordSchema.index({ companyId: 1, deliveredAt: -1 });

deliveryRecordSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('DeliveryRecord', deliveryRecordSchema);
