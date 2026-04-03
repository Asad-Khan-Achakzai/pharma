const doctorActivityService = require('../services/doctorActivity.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../middleware/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const result = await doctorActivityService.list(req.companyId, req.query);
  ApiResponse.paginated(res, result);
});

const create = asyncHandler(async (req, res) => {
  const activity = await doctorActivityService.create(req.companyId, req.body, req.user);
  ApiResponse.created(res, activity);
});

const update = asyncHandler(async (req, res) => {
  const activity = await doctorActivityService.update(req.companyId, req.params.id, req.body, req.user);
  ApiResponse.success(res, activity, 'Doctor activity updated');
});

const getByDoctor = asyncHandler(async (req, res) => {
  const activities = await doctorActivityService.getByDoctor(req.companyId, req.params.id);
  ApiResponse.success(res, activities);
});

module.exports = { list, create, update, getByDoctor };
