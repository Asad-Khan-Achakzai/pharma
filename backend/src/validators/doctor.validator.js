const Joi = require('joi');

const createPharmacySchema = Joi.object({
  name: Joi.string().required().trim().min(1).max(200),
  address: Joi.string().trim().allow(''),
  city: Joi.string().trim().allow(''),
  state: Joi.string().trim().allow(''),
  phone: Joi.string().trim().allow(''),
  email: Joi.string().email().trim().allow('')
});

const updatePharmacySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200),
  address: Joi.string().trim().allow(''),
  city: Joi.string().trim().allow(''),
  state: Joi.string().trim().allow(''),
  phone: Joi.string().trim().allow(''),
  email: Joi.string().email().trim().allow(''),
  isActive: Joi.boolean()
}).min(1);

const createDoctorSchema = Joi.object({
  pharmacyId: Joi.string().required(),
  name: Joi.string().required().trim().min(1).max(200),
  specialization: Joi.string().trim().allow(''),
  phone: Joi.string().trim().allow(''),
  email: Joi.string().email().trim().allow('')
});

const updateDoctorSchema = Joi.object({
  pharmacyId: Joi.string(),
  name: Joi.string().trim().min(1).max(200),
  specialization: Joi.string().trim().allow(''),
  phone: Joi.string().trim().allow(''),
  email: Joi.string().email().trim().allow(''),
  isActive: Joi.boolean()
}).min(1);

const createDoctorActivitySchema = Joi.object({
  doctorId: Joi.string().required(),
  investedAmount: Joi.number().required().min(0),
  expectedSales: Joi.number().required().min(0),
  period: Joi.object({
    startDate: Joi.date().required(),
    endDate: Joi.date().required().greater(Joi.ref('startDate'))
  }).required()
});

const updateDoctorActivitySchema = Joi.object({
  investedAmount: Joi.number().min(0),
  expectedSales: Joi.number().min(0),
  period: Joi.object({
    startDate: Joi.date().required(),
    endDate: Joi.date().required().greater(Joi.ref('startDate'))
  })
}).min(1);

module.exports = {
  createPharmacySchema, updatePharmacySchema,
  createDoctorSchema, updateDoctorSchema,
  createDoctorActivitySchema, updateDoctorActivitySchema
};
