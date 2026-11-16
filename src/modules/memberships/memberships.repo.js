import { pool } from '../../db/pool.js';

export async function findPublishedGroupId(slug) {
  const { rows } = await pool.query(
    `SELECT id::text AS id FROM groups WHERE slug = $1 AND status = 'published'`,
    [slug],
  );
  return rows[0]?.id ?? null;
}

// Reconfere o status no próprio INSERT: o grupo pode sair do ar depois do findPublishedGroupId.
export async function insertMembership(userId, groupId, nickname) {
  const { rowCount } = await pool.query(
    `INSERT INTO memberships (user_id, group_id, nickname)
     SELECT $1, id, $3 FROM groups WHERE id = $2 AND status = 'published'
     ON CONFLICT (user_id, group_id) DO NOTHING`,
    [userId, groupId, nickname],
  );
  return rowCount > 0;
}

// Sem filtro de status: sair sempre funciona, mesmo de grupo que saiu do ar.
export async function deleteMembership(userId, slug) {
  const { rowCount } = await pool.query(
    `DELETE FROM memberships m USING groups g
     WHERE m.group_id = g.id AND g.slug = $2 AND m.user_id = $1`,
    [userId, slug],
  );
  return rowCount > 0;
}

export async function findNickname(userId, slug) {
  const { rows } = await pool.query(
    `SELECT m.nickname FROM memberships m JOIN groups g ON g.id = m.group_id
     WHERE m.user_id = $1 AND g.slug = $2`,
    [userId, slug],
  );
  return rows[0]?.nickname ?? null;
}

export async function listJoinedSlugs(userId) {
  const { rows } = await pool.query(
    `SELECT g.slug FROM memberships m JOIN groups g ON g.id = m.group_id
     WHERE m.user_id = $1 AND g.status = 'published'`,
    [userId],
  );
  return rows.map((r) => r.slug);
}
