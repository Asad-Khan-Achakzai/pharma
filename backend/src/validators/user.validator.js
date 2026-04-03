const Joi = require('joi');
const { ROLES } = require('../constants/enums');
const { ALL_PERMISSIONS } = require('../constants/permissions');

const createUserSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  email: Joi.string().email().required().trim(),
  password: Joi.string().required().min(6).max(128),
  role: Joi.string().valid(...Object.values(ROLES)).required(),
  phone: Joi.string().trim().allow(''),
  permissions: Joi.array().items(Joi.string().valid(...ALL_PERMISSIONS)).default([]),
  isActive: Joi.boolean().default(true)
});

const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  email: Joi.string().email().trim(),
  phone: Joi.string().trim().allow(''),
  role: Joi.string().valid(...Object.values(ROLES)),
  permissions: Joi.array().items(Joi.string().valid(...ALL_PERMISSIONS)),
  isActive: Joi.boolean()
}).min(1);

module.exports = { createUserSchema, updateUserSchema };
