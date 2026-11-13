import bcrypt from 'bcrypt';
import * as usersRepo from './users.repo.js';

const BCRYPT_COST = 12;

export async function findUserById(id) {
  const row = await usersRepo.findById(id);
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role };
}

// O UNIQUE do banco resolve a corrida de dois cadastros iguais: sem SELECT prévio.
export async function signup({ email, password, displayName }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const user = await usersRepo.create({ email, passwordHash, displayName });
    return { user };
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      return { errors: { email: 'Já existe uma conta com esse e-mail.' } };
    }
    throw err;
  }
}
