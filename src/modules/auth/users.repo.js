import { pool } from '../../db/pool.js';

// Colunas explícitas: password_hash não sai deste repo.
export async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, email, display_name, role FROM users WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}
