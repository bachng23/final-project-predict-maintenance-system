const express = require('express');
const bearingsController = require('../../controllers/bearings');

const router = express.Router();

router.get('/overview', bearingsController.getOverview);
router.get('/:bearingId', bearingsController.getDetail);

module.exports = router;
