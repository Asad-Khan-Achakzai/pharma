const mongoose = require('mongoose');
const { softDeletePlugin } = require('../plugins/softDelete');

const stockTransferItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    castingAtTime: { type: Number, required: true },
    shippingCostPerUnit: { type: Number, default: 0 }
  },
  { _id: false }
);

const stockTransferSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    distributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor', required: true },
    items: [stockTransferItemSchema],
    totalShippingCost: { type: Number, default: 0 },
    transferDate: { type: Date, default: Date.now },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

stockTransferSchema.index({ companyId: 1, distributorId: 1, transferDate: -1 });

stockTransferSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
