require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient, UserRole } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: hashedPassword,
      active: true,
      role: UserRole.ADMIN
    },
    create: {
      username: 'admin',
      email: 'admin@example.com',
      fullName: 'System Administrator',
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
      active: true
    }
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });