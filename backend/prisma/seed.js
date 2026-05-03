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
      password_hash: hashedPassword,
    },
    create: {
      username: 'admin',
      full_name: 'System Administrator',
      email: 'admin@example.com',
      password_hash: hashedPassword,
      role: 'ADMIN',
      active: true,
    },
  });
  console.log('Admin user created/updated:', admin.username);

  // 2. Create a sample Bearing
  const bearing = await prisma.bearing.upsert({
    where: { bearing_id: 'XJT-B1' },
    update: {},
    create: {
      bearing_id: 'XJT-B1',
      display_name: 'Bearing XJTU-SY B1',
      dataset_source: 'XJTU-SY',
      condition_label: '35HZ_12KN',
      rpm: 2100,
      load_kn: 12,
      status: 'NORMAL',
      active: true,
    },
  });
  console.log('Sample bearing created:', bearing.bearing_id);

  // 3. Create Sample Prediction
  const prediction = await prisma.prediction.upsert({
    where: {
      bearing_id_file_idx_model_version: {
        bearing_id: bearing.id,
        file_idx: 1,
        model_version: 'v1.0.0',
      },
    },
    update: {},
    create: {
      bearing_id: bearing.id,
      file_idx: 1,
      sample_ts: new Date(),
      rul_minutes: 150.5,
      rul_lower_minutes: 140.0,
      rul_upper_minutes: 161.0,
      rul_uncertainty: 0.02,
      p_fail: 0.05,
      health_score: 92.0,
      degradation_rate: 0.001,
      ood_flag: false,
      model_version: 'v1.0.0',
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
      bearing_id: bearing.id,
      prediction_id: prediction.id,
      snapshot_ts: new Date(),
      status: 'PENDING_REVIEW',
      trigger_source: 'ANOMALY_TRIGGER',
    },
  });
  console.log('Sample snapshot created/updated');

  // 5. Create Sample Decision
  await prisma.decision.upsert({
    where: { snapshot_id: snapshot.id },
    update: {},
    create: {
      snapshot_id: snapshot.id,
      decision_type: 'INSPECTION',
      recommended_action: 'INSPECT',
      recommended_confidence: 0.85,
      decision_status: 'PENDING',
      priority: 'MEDIUM',
      reason_summary: 'Abnormal vibration patterns detected in latest cycle.',
    },
  });
  console.log('Sample decision created/updated');

  // 6. Create Runtime Configs
  await prisma.runtimeConfig.upsert({
    where: { config_key: 'thresholds_v1' },
    update: {},
    create: {
      config_group: 'THRESHOLDS',
      config_key: 'thresholds_v1',
      config_value_json: { tau_star: 0.15, hybrid_score_threshold: 0.7 },
      version_no: 1,
      is_active: true,
    },
  });

  await prisma.runtimeConfig.upsert({
    where: { config_key: 'agents_v1' },
    update: {},
    create: {
      config_group: 'AGENTS',
      config_key: 'agents_v1',
      config_value_json: { max_negotiation_rounds: 5, llm_model_name: 'gpt-4o' },
      version_no: 1,
      is_active: true,
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
