const prisma = require('./prisma.service');

class PredictionService {
  async getPredictionHistory(bearingId, filters = {}) {
    const { limit = 50, from_idx, from_ts, to_ts } = filters;

    const where = {
      bearing: { bearingId }
    };

    if (from_idx) {
      where.fileIdx = { gte: parseInt(from_idx) };
    }

    if (from_ts || to_ts) {
      where.sampleTs = {};
      if (from_ts) where.sampleTs.gte = new Date(from_ts);
      if (to_ts) where.sampleTs.lte = new Date(to_ts);
    }

    const predictions = await prisma.prediction.findMany({
      where,
      orderBy: { sampleTs: 'desc' },
      take: parseInt(limit),
    });

    return predictions;
  }

  async getLatestPrediction(bearingId) {
    const prediction = await prisma.prediction.findFirst({
      where: {
        bearing: { bearingId }
      },
      orderBy: { sampleTs: 'desc' },
    });

    if (!prediction) {
      throw new Error('PREDICTION_NOT_FOUND');
    }

    return prediction;
  }
}

module.exports = new PredictionService();
