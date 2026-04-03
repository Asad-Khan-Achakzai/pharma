const express = require('express');
const router = express.Router();
const c = require('../../controllers/weeklyPlan.controller');
const { authenticate } = require('../../middleware/auth');
const { companyScope } = require('../../middleware/companyScope');
const { checkPermission } = require('../../middleware/checkPermission');
const { validate } = require('../../middleware/validate');
const { createWeeklyPlanSchema, updateWeeklyPlanSchema } = require('../../validators/target.validator');

router.use(authenticate, companyScope);
router.get('/', checkPermission('weeklyPlans.view'), c.list);
router.post('/', checkPermission('weeklyPlans.create'), validate(createWeeklyPlanSchema), c.create);
router.put('/:id', checkPermission('weeklyPlans.edit'), validate(updateWeeklyPlanSchema), c.update);
router.get('/rep/:id', checkPermission('weeklyPlans.view'), c.getByRep);

module.exports = router;
