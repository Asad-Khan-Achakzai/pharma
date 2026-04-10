const attendanceService = require('../services/attendance.service');
const salaryStructureService = require('../services/salaryStructure.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/enums');

const assertEmployeeScope = (req, employeeId) => {
  if (req.user.role === ROLES.ADMIN) return;
  if (employeeId !== req.user.userId) throw new ApiError(403, 'You can only access your own attendance');
};

const mark = asyncHandler(async (req, res) => {
  const doc = await attendanceService.markSelf(req.companyId, req.user.userId, req.body);
  ApiResponse.success(res, doc, 'Attendance saved');
});

const checkin = asyncHandler(async (req, res) => {
  const doc = await attendanceService.checkIn(req.companyId, req.user.userId);
  ApiResponse.success(res, doc, 'Checked in');
});

const checkout = asyncHandler(async (req, res) => {
  const doc = await attendanceService.checkOut(req.companyId, req.user.userId);
  ApiResponse.success(res, doc, 'Checked out');
});

const meToday = asyncHandler(async (req, res) => {
  const doc = await attendanceService.getMeToday(req.companyId, req.user.userId);
  ApiResponse.success(res, doc);
});

const today = asyncHandler(async (req, res) => {
  const data = await attendanceService.listToday(req.companyId);
  ApiResponse.success(res, data);
});

const report = asyncHandler(async (req, res) => {
  assertEmployeeScope(req, req.query.employeeId);
  const data = await attendanceService.report(req.companyId, req.query);
  ApiResponse.success(res, data);
});

const monthlySummary = asyncHandler(async (req, res) => {
  assertEmployeeScope(req, req.query.employeeId);
  const structure = await salaryStructureService.getActiveForEmployee(req.companyId, req.query.employeeId);
  const rate = structure?.dailyAllowance ?? 0;
  const data = await attendanceService.monthlySummary(
    req.companyId,
    req.query.employeeId,
    req.query.month,
    rate
  );
  ApiResponse.success(res, data);
});

module.exports = { mark, checkin, checkout, meToday, today, report, monthlySummary };
