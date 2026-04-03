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

module.exports = router;
