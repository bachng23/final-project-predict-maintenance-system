const prisma = require('./prisma.service');

class ConfigService {
  async getConfig(group) {
    const config = await prisma.runtimeConfig.findFirst({
      where: { configGroup: group, isActive: true },
      orderBy: { versionNo: 'desc' },
    });

    if (!config) {
      // Return default if not found or throw error
      return {};
    }

    return {
      ...config.configValueJson,
      effective_version: config.versionNo,
      updated_at: config.updatedAt,
      updated_by: config.updatedBy,
    };
  }

  async updateConfig(group, newData, actorUserId) {
    // Get latest version
    const latestConfig = await prisma.runtimeConfig.findFirst({
      where: { configGroup: group },
      orderBy: { versionNo: 'desc' },
    });

    const nextVersion = (latestConfig?.versionNo || 0) + 1;

    // Deactivate current configs in this group
    await prisma.runtimeConfig.updateMany({
      where: { configGroup: group, isActive: true },
      data: { isActive: false },
    });

    // Create new version
    // In this simple implementation, we assume config_key is group_key or similar
    // Actually, contract says config_key is required. Let's use group as prefix or key.
    
    const configKey = `${group.toLowerCase()}_v${nextVersion}`;

    const newConfig = await prisma.runtimeConfig.create({
      data: {
        configGroup: group,
        configKey,
        configValueJson: newData,
        versionNo: nextVersion,
        isActive: true,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      },
    });

    // Log to Audit Log
    await prisma.auditLog.create({
      data: {
        entityType: 'CONFIG',
        entityId: newConfig.id,
        action: `UPDATE_${group}`,
        actorUserId,
        payloadJson: newData,
        createdAt: new Date(),
      },
    });

    return {
      ...newConfig.configValueJson,
      effective_version: newConfig.versionNo,
      updated_at: newConfig.updatedAt,
      updated_by: newConfig.updatedBy,
    };
  }
}

module.exports = new ConfigService();
