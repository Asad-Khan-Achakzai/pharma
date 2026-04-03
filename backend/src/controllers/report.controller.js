const reportService = require('../services/report.service');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../middleware/asyncHandler');

const dashboard = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.dashboard(req.companyId)); });
const sales = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.sales(req.companyId, req.query.from, req.query.to)); });
const profit = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.profit(req.companyId, req.query.from, req.query.to)); });
const expenses = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.expenses(req.companyId, req.query.from, req.query.to)); });
const inventoryValuation = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.inventoryValuation(req.companyId)); });
const doctorROI = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.doctorROI(req.companyId)); });
const repPerformance = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.repPerformance(req.companyId)); });
const outstandingReport = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.outstanding(req.companyId)); });
const cashFlow = asyncHandler(async (req, res) => { ApiResponse.success(res, await reportService.cashFlow(req.companyId, req.query.from, req.query.to)); });

module.exports = { dashboard, sales, profit, expenses, inventoryValuation, doctorROI, repPerformance, outstanding: outstandingReport, cashFlow };
