require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // 1. Create Admin User
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: hashedPassword,
    },
    create: {
      username: 'admin',
      fullName: 'System Administrator',
      email: 'admin@example.com',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      active: true,
    },
  });
  console.log('Admin user created/updated:', admin.username);

  // 2. Create a sample Bearing
  const bearing = await prisma.bearing.upsert({
    where: { bearingId: 'XJT-B1' },
    update: {},
    create: {
      bearingId: 'XJT-B1',
      displayName: 'Bearing XJTU-SY B1',
      datasetSource: 'XJTU-SY',
      conditionLabel: '35HZ_12KN',
      rpm: 2100,
      loadKn: 12,
      status: 'NORMAL',
      active: true,
    },
  });
  console.log('Sample bearing created:', bearing.bearingId);

  // 3. Create Sample Prediction
  const prediction = await prisma.prediction.upsert({
    where: {
      bearingId_fileIdx_modelVersion: {
        bearingId: bearing.id,
        fileIdx: 1,
        modelVersion: 'v1.0.0',
      },
    },
    update: {},
    create: {
      bearingId: bearing.id,
      fileIdx: 1,
      sampleTs: new Date(),
      rulMinutes: 9030.0,
      pFail: 0.05,
      healthScore: 92.0,
      modelVersion: 'v1.0.0',
    },
  });
  console.log('Sample prediction created/updated');

  // 4. Create Sample Snapshot
  const snapshot = await prisma.snapshot.upsert({
    where: {
      id: '00000000-0000-0000-0000-000000000001', 
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      bearingId: bearing.id,
      predictionId: prediction.id,
      snapshotTs: new Date(),
      status: 'PENDING_REVIEW',
      triggerSource: 'ANOMALY_TRIGGER',
    },
  });
  console.log('Sample snapshot created/updated');

  // 5. Create Sample Decision
  await prisma.decision.upsert({
    where: { snapshotId: snapshot.id },
    update: {},
    create: {
      snapshotId: snapshot.id,
      decisionType: 'INSPECTION',
      recommendedAction: 'INSPECT',
      recommendedConfidence: 0.85,
      decisionStatus: 'PENDING',
      priority: 'MEDIUM',
      reasonSummary: 'Abnormal vibration patterns detected in latest cycle.',
    },
  });
  console.log('Sample decision created/updated');

  // 6. Create Runtime Configs
  await prisma.runtimeConfig.upsert({
    where: { configKey: 'thresholds_v1' },
    update: {},
    create: {
      configGroup: 'THRESHOLDS',
      configKey: 'thresholds_v1',
      configValueJson: { tau_star: 0.15, hybrid_score_threshold: 0.7 },
      versionNo: 1,
      isActive: true,
    },
  });

  await prisma.runtimeConfig.upsert({
    where: { configKey: 'agents_v1' },
    update: {},
    create: {
      configGroup: 'AGENTS',
      configKey: 'agents_v1',
      configValueJson: { max_negotiation_rounds: 5, llm_model_name: 'gpt-4o' },
      versionNo: 1,
      isActive: true,
    },
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
