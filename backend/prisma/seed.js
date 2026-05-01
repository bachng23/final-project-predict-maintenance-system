const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // 1. Create Admin User
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'System Administrator',
      email: 'admin@example.com',
      passwordHash: 'hashed_password_here', // In production, use bcrypt
      role: 'ADMIN',
      active: true,
    },
  });
  console.log('Admin user created:', admin.username);

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

  // 3. Create Runtime Configs
  await prisma.runtimeConfig.create({
    data: {
      configGroup: 'THRESHOLDS',
      configKey: 'tau_star',
      configValueJson: { value: 0.15 },
      versionNo: 1,
      isActive: true,
    },
  });

  await prisma.runtimeConfig.create({
    data: {
      configGroup: 'AGENTS',
      configKey: 'max_rounds',
      configValueJson: { value: 5 },
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
