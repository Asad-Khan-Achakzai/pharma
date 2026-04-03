const weeklyPlanService = require('../services/weeklyPlan.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../middleware/asyncHandler');

const list = asyncHandler(async (req, res) => { ApiResponse.paginated(res, await weeklyPlanService.list(req.companyId, req.query)); });
const create = asyncHandler(async (req, res) => { ApiResponse.created(res, await weeklyPlanService.create(req.companyId, req.body, req.user)); });
const update = asyncHandler(async (req, res) => { ApiResponse.success(res, await weeklyPlanService.update(req.companyId, req.params.id, req.body, req.user), 'Plan updated'); });
const getByRep = asyncHandler(async (req, res) => { ApiResponse.success(res, await weeklyPlanService.getByRep(req.companyId, req.params.id)); });

module.exports = { list, create, update, getByRep };
