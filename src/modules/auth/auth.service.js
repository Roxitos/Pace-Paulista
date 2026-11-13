import * as usersRepo from './users.repo.js';

export async function findUserById(id) {
  const row = await usersRepo.findById(id);
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role };
}
