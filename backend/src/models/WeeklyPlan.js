const mongoose = require('mongoose');
const { WEEKLY_PLAN_STATUS } = require('../constants/enums');
const { softDeletePlugin } = require('../plugins/softDelete');

const visitSchema = new mongoose.Schema(
  {
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    planned: { type: Boolean, default: true },
    completed: { type: Boolean, default: false },
    notes: { type: String }
  },
  { _id: false }
);

const weeklyPlanSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    medicalRepId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    weekStartDate: { type: Date, required: true },
    weekEndDate: { type: Date, required: true },
    doctorVisits: [visitSchema],
    distributorVisits: [visitSchema],
    status: { type: String, enum: Object.values(WEEKLY_PLAN_STATUS), default: WEEKLY_PLAN_STATUS.DRAFT }
  },
  { timestamps: true }
);

weeklyPlanSchema.index({ companyId: 1, medicalRepId: 1, weekStartDate: -1 });

weeklyPlanSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('WeeklyPlan', weeklyPlanSchema);
