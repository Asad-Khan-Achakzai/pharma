const Joi = require('joi');

const createPayrollSchema = Joi.object({
  employeeId: Joi.string().required(),
  month: Joi.string().required().pattern(/^\d{4}-\d{2}$/),
  baseSalary: Joi.number().required().min(0),
  bonus: Joi.number().min(0).default(0),
  deductions: Joi.number().min(0).default(0)
});

const updatePayrollSchema = Joi.object({
  baseSalary: Joi.number().min(0),
  bonus: Joi.number().min(0),
  deductions: Joi.number().min(0)
}).min(1);

module.exports = { createPayrollSchema, updatePayrollSchema };
