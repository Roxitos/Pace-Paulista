import { pool } from '../../db/pool.js';

// Colunas explícitas: password_hash não sai deste repo.
export async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, email, display_name, role FROM users WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

// Não captura erro: o service trata a violação de UNIQUE (23505) do e-mail.
export async function create({ email, passwordHash, displayName }) {
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
    [email, passwordHash, displayName],
  );
  return rows[0];
}
