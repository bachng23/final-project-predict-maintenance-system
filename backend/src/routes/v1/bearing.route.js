const express = require('express');
const bearingController = require('../../controllers/bearing.controller');

const router = express.Router();

router.get('/', bearingController.getBearings);

module.exports = router;
