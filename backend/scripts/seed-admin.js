require('dotenv').config();
const bcrypt = require('bcryptjs');
const database = require('../src/services/database');

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await database.query(
    `
      INSERT INTO users (username, email, full_name, password_hash, role, active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          active = TRUE,
          updated_at = NOW()
    `,
    ['admin', 'admin@example.com', 'System Administrator', passwordHash, 'ADMIN']
  );

  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.closePool();
  });
