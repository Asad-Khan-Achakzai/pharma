const Joi = require('joi');

const transferSchema = Joi.object({
  distributorId: Joi.string().required(),
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required()
    })
  ).min(1).required(),
  totalShippingCost: Joi.number().min(0).default(0),
  notes: Joi.string().trim().allow('')
});

module.exports = { transferSchema };
