import bcrypt from 'bcrypt';
import * as usersRepo from './users.repo.js';

const BCRYPT_COST = 12;
// O bcrypt só olha 72 bytes: acima disso é credencial errada, sem gastar CPU com corpo gigante.
const MAX_LOGIN_PASSWORD = 1024;
// E-mail inexistente também paga um bcrypt.compare: o tempo não revela se a conta existe.
const DUMMY_HASH = bcrypt.hashSync('pace-paulista-dummy', BCRYPT_COST);

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

export async function login({ email, password }) {
  if (password.length > MAX_LOGIN_PASSWORD) return null;
  const creds = await usersRepo.findCredentialsByEmail(email);
  const ok = await bcrypt.compare(password, creds ? creds.password_hash : DUMMY_HASH);
  if (!creds || !ok) return null;
  const user = await findUserById(creds.id);
  return user ? { user } : null;
}
