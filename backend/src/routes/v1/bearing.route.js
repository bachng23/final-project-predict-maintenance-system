const express = require('express');
const bearingController = require('../../controllers/bearing.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', bearingController.getBearings);
router.get('/:id/predictions', bearingController.getBearingPredictions);

module.exports = router;
