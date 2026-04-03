const payrollService = require('../services/payroll.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../middleware/asyncHandler');

const list = asyncHandler(async (req, res) => { ApiResponse.paginated(res, await payrollService.list(req.companyId, req.query)); });
const create = asyncHandler(async (req, res) => { ApiResponse.created(res, await payrollService.create(req.companyId, req.body, req.user)); });
const update = asyncHandler(async (req, res) => { ApiResponse.success(res, await payrollService.update(req.companyId, req.params.id, req.body, req.user), 'Payroll updated'); });
const pay = asyncHandler(async (req, res) => { ApiResponse.success(res, await payrollService.pay(req.companyId, req.params.id, req.user), 'Salary paid'); });

module.exports = { list, create, update, pay };
