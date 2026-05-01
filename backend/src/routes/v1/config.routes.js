const express = require('express');
const router = express.Router();
const configController = require('../../controllers/config.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

router.use(authenticate);

router.get('/thresholds', configController.getThresholds);
router.patch('/thresholds', authorize(['ENGINEER', 'ADMIN']), configController.updateThresholds);

router.get('/agents', configController.getAgents);
router.patch('/agents', authorize(['ENGINEER', 'ADMIN']), configController.updateAgents);

router.get('/synthetic-context', configController.getSyntheticContext);
router.patch('/synthetic-context', authorize(['ENGINEER', 'ADMIN']), configController.updateSyntheticContext);

module.exports = router;
