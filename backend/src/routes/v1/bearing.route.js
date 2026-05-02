const express = require('express');
const bearingController = require('../../controllers/bearing.controller');

const router = express.Router();

router.get('/', bearingController.getBearings);
router.get('/:id/predictions', bearingController.getBearingPredictions);

module.exports = router;
