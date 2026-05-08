const BASE_TIME = new Date('2026-05-02T12:00:00.000Z').getTime();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildTrend({ vibrationBase, temperatureBase, healthBase, loadBase, anomalyBase, rpmBase, pressureBase, rulBase }) {
  return Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin(index / 3.2);
    const drift = index / 18;
    const vibration = Number((vibrationBase + wave * 0.28 + drift * 0.15).toFixed(2));
    const temperature = Number((temperatureBase + wave * 1.6 + drift * 0.9).toFixed(1));
    const healthScore = Math.round(clamp(healthBase - drift * 3.4 + wave * 2.8, 18, 99));
    const loadPct = Math.round(clamp(loadBase + Math.cos(index / 4.1) * 9 + drift * 2.5, 32, 96));
    const anomalyScore = Number(clamp(anomalyBase + drift * 0.03 + Math.max(0, wave) * 0.06, 0.05, 0.98).toFixed(2));
    const pressure = Number((pressureBase + Math.cos(index / 4.4) * 0.12 + drift * 0.05).toFixed(2));
    const rpm = Math.round(clamp(rpmBase + wave * 22 - drift * 4, 900, 3600));
    const predictedFailureHours = Math.round(clamp(rulBase - drift * 28 - Math.max(0, wave) * 18, 6, 2000));

    return {
      timestamp: new Date(BASE_TIME - (23 - index) * 60 * 60 * 1000).toISOString(),
      vibration,
      temperature,
      healthScore,
      loadPct,
      anomalyScore,
      pressure,
      rpm,
      predictedFailureHours
    };
  });
}

const bearings = [
  {
    id: 'BRG-101',
    machineName: 'Compressor A',
    location: 'Line 1',
    status: 'healthy',
    healthScore: 91,
    temperatureC: 63.4,
    vibrationMmS: 2.8,
    loadPct: 68,
    rpm: 1780,
    predictedFailureHours: 640,
    anomalyScore: 0.14,
    lastUpdated: '2026-05-02T11:55:00.000Z',
    alerts: ['Stable operation', 'Lubrication cycle completed'],
    trend: buildTrend({
      vibrationBase: 2.45,
      temperatureBase: 61.5,
      healthBase: 95,
      loadBase: 65,
      anomalyBase: 0.1,
      rpmBase: 1780,
      pressureBase: 4.82,
      rulBase: 640
    })
  },
  {
    id: 'BRG-102',
    machineName: 'Conveyor B',
    location: 'Line 2',
    status: 'warning',
    healthScore: 72,
    temperatureC: 79.1,
    vibrationMmS: 4.9,
    loadPct: 83,
    rpm: 1560,
    predictedFailureHours: 168,
    anomalyScore: 0.48,
    lastUpdated: '2026-05-02T11:57:00.000Z',
    alerts: ['Temperature rising', 'Monitor imbalance during peak shift'],
    trend: buildTrend({
      vibrationBase: 4.1,
      temperatureBase: 74.8,
      healthBase: 80,
      loadBase: 76,
      anomalyBase: 0.36,
      rpmBase: 1560,
      pressureBase: 5.08,
      rulBase: 168
    })
  },
  {
    id: 'BRG-103',
    machineName: 'Pump C',
    location: 'Line 3',
    status: 'critical',
    healthScore: 39,
    temperatureC: 92.6,
    vibrationMmS: 6.7,
    loadPct: 91,
    rpm: 1490,
    predictedFailureHours: 26,
    anomalyScore: 0.86,
    lastUpdated: '2026-05-02T11:58:00.000Z',
    alerts: ['Critical vibration threshold exceeded', 'Immediate inspection recommended'],
    trend: buildTrend({
      vibrationBase: 5.7,
      temperatureBase: 87.4,
      healthBase: 52,
      loadBase: 84,
      anomalyBase: 0.72,
      rpmBase: 1490,
      pressureBase: 5.34,
      rulBase: 26
    })
  },
  {
    id: 'BRG-104',
    machineName: 'Fan D',
    location: 'Line 4',
    status: 'healthy',
    healthScore: 88,
    temperatureC: 58.9,
    vibrationMmS: 2.4,
    loadPct: 61,
    rpm: 1840,
    predictedFailureHours: 520,
    anomalyScore: 0.11,
    lastUpdated: '2026-05-02T11:54:00.000Z',
    alerts: ['Low vibration profile'],
    trend: buildTrend({
      vibrationBase: 2.1,
      temperatureBase: 57,
      healthBase: 92,
      loadBase: 58,
      anomalyBase: 0.08,
      rpmBase: 1840,
      pressureBase: 4.76,
      rulBase: 520
    })
  }
];

function buildFleetTrend() {
  return bearings[0].trend.map((point, index) => {
    const snapshots = bearings.map((bearing) => bearing.trend[index]);
    const healthScore = Math.round(
      snapshots.reduce((sum, item) => sum + item.healthScore, 0) / snapshots.length
    );
    const temperature = Number(
      (snapshots.reduce((sum, item) => sum + item.temperature, 0) / snapshots.length).toFixed(1)
    );
    const vibration = Number(
      (snapshots.reduce((sum, item) => sum + item.vibration, 0) / snapshots.length).toFixed(2)
    );
    const failureProbability = Number(
      (
        snapshots.reduce((sum, item) => sum + item.anomalyScore * 100, 0) / snapshots.length
      ).toFixed(1)
    );
    const rul = Math.round(
      snapshots.reduce((sum, item) => sum + item.predictedFailureHours, 0) / snapshots.length
    );

    return {
      timestamp: point.timestamp,
      healthScore,
      temperature,
      vibration,
      failureProbability,
      rul
    };
  });
}

function getOverview() {
  const summary = {
    totalBearings: bearings.length,
    healthyCount: bearings.filter((bearing) => bearing.status === 'healthy').length,
    warningCount: bearings.filter((bearing) => bearing.status === 'warning').length,
    criticalCount: bearings.filter((bearing) => bearing.status === 'critical').length,
    averageHealth: Math.round(bearings.reduce((sum, bearing) => sum + bearing.healthScore, 0) / bearings.length),
    averageTemperature: Number(
      (bearings.reduce((sum, bearing) => sum + bearing.temperatureC, 0) / bearings.length).toFixed(1)
    ),
    averageVibration: Number(
      (bearings.reduce((sum, bearing) => sum + bearing.vibrationMmS, 0) / bearings.length).toFixed(2)
    ),
    maintenanceDueSoon: bearings.filter((bearing) => bearing.predictedFailureHours <= 168).length
  };

  return {
    summary,
    fleetTrend: buildFleetTrend(),
    bearings: bearings.map((bearing) => ({
      id: bearing.id,
      machineName: bearing.machineName,
      location: bearing.location,
      status: bearing.status,
      healthScore: bearing.healthScore,
      temperatureC: bearing.temperatureC,
      vibrationMmS: bearing.vibrationMmS,
      loadPct: bearing.loadPct,
      rpm: bearing.rpm,
      predictedFailureHours: bearing.predictedFailureHours,
      anomalyScore: bearing.anomalyScore,
      lastUpdated: bearing.lastUpdated
    }))
  };
}

function getBearingById(bearingId) {
  const bearing = bearings.find((item) => item.id === bearingId);

  if (!bearing) {
    return null;
  }

  return {
    ...bearing,
    stats: {
      maxTemperature: Math.max(...bearing.trend.map((point) => point.temperature)),
      maxVibration: Math.max(...bearing.trend.map((point) => point.vibration)),
      minHealthScore: Math.min(...bearing.trend.map((point) => point.healthScore)),
      averageLoad: Math.round(bearing.trend.reduce((sum, point) => sum + point.loadPct, 0) / bearing.trend.length)
    }
  };
}

module.exports = {
  getOverview,
  getBearingById
};
