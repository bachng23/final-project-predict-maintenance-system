const crypto = require('crypto');
const database = require('../services/database');
const { mapUser } = require('./users');

function mapRefreshToken(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    user: row.user_id_joined
      ? mapUser({
          id: row.user_id_joined,
          username: row.username,
          email: row.email,
          full_name: row.full_name,
          password_hash: row.password_hash,
          role: row.role,
          active: row.active,
          last_login_at: row.last_login_at
        })
      : null
  };
}

async function create({ userId, tokenHash, expiresAt }, client = database) {
  const result = await client.query(
    `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, token_hash, expires_at, revoked_at
    `,
    [crypto.randomUUID(), userId, tokenHash, expiresAt]
  );

  return mapRefreshToken(result.rows[0]);
}

async function findByTokenHash(tokenHash) {
  const result = await database.query(
    `
      SELECT id, user_id, token_hash, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );

  return mapRefreshToken(result.rows[0]);
}

async function findByTokenHashWithUser(tokenHash) {
  const result = await database.query(
    `
      SELECT
        rt.id,
        rt.user_id,
        rt.token_hash,
        rt.expires_at,
        rt.revoked_at,
        u.id AS user_id_joined,
        u.username,
        u.email,
        u.full_name,
        u.password_hash,
        u.role,
        u.active,
        u.last_login_at
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );

  return mapRefreshToken(result.rows[0]);
}

async function revokeById(id, revokedAt = new Date(), client = database) {
  const result = await client.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, user_id, token_hash, expires_at, revoked_at
    `,
    [id, revokedAt]
  );

  return mapRefreshToken(result.rows[0]);
}

module.exports = {
  create,
  findByTokenHash,
  findByTokenHashWithUser,
  revokeById
};
