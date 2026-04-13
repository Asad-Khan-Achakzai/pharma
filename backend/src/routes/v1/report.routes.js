const express = require('express');
const router = express.Router();
const c = require('../../controllers/report.controller');
const { authenticate } = require('../../middleware/auth');
const { companyScope } = require('../../middleware/companyScope');
const { checkPermission } = require('../../middleware/checkPermission');

router.use(authenticate, companyScope);
router.get('/dashboard', checkPermission('dashboard.view'), c.dashboard);
router.get('/sales', checkPermission('reports.view'), c.sales);
router.get('/profit', checkPermission('reports.view'), c.profit);
router.get('/expenses', checkPermission('reports.view'), c.expenses);
router.get('/inventory-valuation', checkPermission('reports.view'), c.inventoryValuation);
router.get('/doctor-roi', checkPermission('reports.view'), c.doctorROI);
router.get('/rep-performance', checkPermission('reports.view'), c.repPerformance);
router.get('/outstanding', checkPermission('reports.view'), c.outstanding);
router.get('/cash-flow', checkPermission('reports.view'), c.cashFlow);

/** Financial position & period activity (collections, settlements, clearing). */
router.get('/financial/overview', checkPermission('reports.view'), c.financialOverview);
router.get('/financial/pharmacy-balances', checkPermission('reports.view'), c.pharmacyBalances);
router.get('/financial/pharmacies/:id/detail', checkPermission('reports.view'), c.pharmacyBalanceDetail);
router.get('/financial/distributor-balances', checkPermission('reports.view'), c.distributorBalances);
router.get('/financial/distributors/:id/detail', checkPermission('reports.view'), c.distributorBalanceDetail);
router.get('/financial/collections', checkPermission('reports.view'), c.collectionsPeriod);
router.get('/financial/settlements', checkPermission('reports.view'), c.settlementsPeriod);
router.get('/financial/cash-summary', checkPermission('reports.view'), c.financialCashSummary);

/** Profit & cost management (transaction-based revenue, auditable cost buckets) */
router.get('/summary', checkPermission('reports.view'), c.profitSummary);
router.get('/revenue', checkPermission('reports.view'), c.profitRevenue);
router.get('/costs', checkPermission('reports.view'), c.profitCosts);
router.get('/product-profitability', checkPermission('reports.view'), c.profitProductProfitability);
router.get('/trends', checkPermission('reports.view'), c.profitTrends);

module.exports = router;
