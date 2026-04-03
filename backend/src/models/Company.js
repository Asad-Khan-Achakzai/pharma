const mongoose = require('mongoose');
const { softDeletePlugin } = require('../plugins/softDelete');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, default: 'Pakistan' },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    logo: { type: String },
    currency: { type: String, default: 'PKR' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

companySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Company', companySchema);
