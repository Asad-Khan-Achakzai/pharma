const Joi = require('joi');

const createTargetSchema = Joi.object({
  medicalRepId: Joi.string().required(),
  month: Joi.string().required().pattern(/^\d{4}-\d{2}$/),
  salesTarget: Joi.number().required().min(0),
  packsTarget: Joi.number().integer().required().min(0)
});

const updateTargetSchema = Joi.object({
  salesTarget: Joi.number().min(0),
  packsTarget: Joi.number().integer().min(0)
}).min(1);

const createWeeklyPlanSchema = Joi.object({
  medicalRepId: Joi.string(),
  weekStartDate: Joi.date().required(),
  weekEndDate: Joi.date().required(),
  doctorVisits: Joi.array().items(Joi.object({ entityId: Joi.string().required(), planned: Joi.boolean().default(true), completed: Joi.boolean().default(false), notes: Joi.string().allow('') })),
  distributorVisits: Joi.array().items(Joi.object({ entityId: Joi.string().required(), planned: Joi.boolean().default(true), completed: Joi.boolean().default(false), notes: Joi.string().allow('') })),
  status: Joi.string().valid('DRAFT', 'SUBMITTED', 'REVIEWED')
});

const updateWeeklyPlanSchema = Joi.object({
  doctorVisits: Joi.array().items(Joi.object({ entityId: Joi.string().required(), planned: Joi.boolean(), completed: Joi.boolean(), notes: Joi.string().allow('') })),
  distributorVisits: Joi.array().items(Joi.object({ entityId: Joi.string().required(), planned: Joi.boolean(), completed: Joi.boolean(), notes: Joi.string().allow('') })),
  status: Joi.string().valid('DRAFT', 'SUBMITTED', 'REVIEWED')
}).min(1);

module.exports = { createTargetSchema, updateTargetSchema, createWeeklyPlanSchema, updateWeeklyPlanSchema };
