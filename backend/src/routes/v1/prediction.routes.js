const express = require('express');
const router = express.Router();
const predictionController = require('../../controllers/prediction.controller');

router.get('/:bearing_id', predictionController.getPredictionHistory);
router.get('/:bearing_id/latest', predictionController.getLatestPrediction);

module.exports = router;
