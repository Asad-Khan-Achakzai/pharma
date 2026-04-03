const paymentService = require('../services/payment.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../middleware/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const result = await paymentService.list(req.companyId, req.query);
  ApiResponse.paginated(res, result);
});

const create = asyncHandler(async (req, res) => {
  const payment = await paymentService.create(req.companyId, req.body, req.user);
  ApiResponse.created(res, payment, 'Payment recorded');
});

const getById = asyncHandler(async (req, res) => {
  const payment = await paymentService.getById(req.companyId, req.params.id);
  ApiResponse.success(res, payment);
});

const getByPharmacy = asyncHandler(async (req, res) => {
  const payments = await paymentService.getByPharmacy(req.companyId, req.params.id);
  ApiResponse.success(res, payments);
});

module.exports = { list, create, getById, getByPharmacy };
