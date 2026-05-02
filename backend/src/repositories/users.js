const database = require('../services/database');

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    role: row.role,
    active: row.active,
    lastLoginAt: row.last_login_at
  };
}

async function findByUsername(username) {
  const result = await database.query(
    `
      SELECT id, username, email, full_name, password_hash, role, active, last_login_at
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [username]
  );

  return mapUser(result.rows[0]);
}

async function updateLastLoginAt(userId, loginAt, client = database) {
  const result = await client.query(
    `
      UPDATE users
      SET last_login_at = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, full_name, password_hash, role, active, last_login_at
    `,
    [userId, loginAt]
  );

  return mapUser(result.rows[0]);
}

module.exports = {
  findByUsername,
  updateLastLoginAt,
  mapUser
};
