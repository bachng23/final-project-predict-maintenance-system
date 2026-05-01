const express = require('express');
const router = express.Router();
const bearingController = require('../../controllers/bearing.controller');

router.get('/', bearingController.getAllBearings);
router.get('/:bearing_id', bearingController.getBearingById);

module.exports = router;
