const mongoose = require('mongoose');
const { softDeletePlugin } = require('../plugins/softDelete');

const doctorActivitySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    investedAmount: { type: Number, required: true },
    expectedSales: { type: Number, required: true },
    achievedSales: { type: Number, default: 0 },
    roi: { type: Number, default: 0 },
    period: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true }
    }
  },
  { timestamps: true }
);

doctorActivitySchema.index({ companyId: 1, doctorId: 1, 'period.startDate': 1 });

doctorActivitySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('DoctorActivity', doctorActivitySchema);
