const prisma = require('./prisma.service');

class MonitoringService {
  async getHealth() {
    let databaseStatus = 'UP';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      databaseStatus = 'DOWN';
    }

    return {
      service_status: 'UP',
      database_status: databaseStatus,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  async getMetricsSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const decisionsToday = await prisma.decision.count({
      where: { openedAt: { gte: today } },
    });

    const pendingDecisions = await prisma.decision.count({
      where: { decisionStatus: 'PENDING' },
    });

    const totalResolved = await prisma.decision.count({
      where: { decisionStatus: 'RESOLVED' },
    });

    const totalOverrides = await prisma.decisionAction.count({
      where: { action: 'OVERRIDE' },
    });

    const overrideRate = totalResolved > 0 ? (totalOverrides / totalResolved) : 0;

    return {
      decisions_today: decisionsToday,
      pending_decisions: pendingDecisions,
      override_rate: overrideRate,
      active_ws_connections: 0, // Placeholder
    };
  }
}

module.exports = new MonitoringService();
