const mongoose = require('mongoose');
const { PAYROLL_STATUS } = require('../constants/enums');
const { softDeletePlugin } = require('../plugins/softDelete');

const payrollSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true },
    baseSalary: { type: Number, required: true },
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    paidOn: { type: Date },
    status: { type: String, enum: Object.values(PAYROLL_STATUS), default: PAYROLL_STATUS.PENDING }
  },
  { timestamps: true }
);

payrollSchema.index({ companyId: 1, employeeId: 1, month: 1 }, { unique: true });

payrollSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Payroll', payrollSchema);
