import { parseJoinForm } from './memberships.schemas.js';
import * as membershipsRepo from './memberships.repo.js';

const FK_VIOLATION = '23503';

export async function joinGroup(slug, userId, body) {
  const group = await membershipsRepo.findPublishedGroup(slug);
  if (!group) return { notFound: true };
  // O dono já está em "Participantes" (base_participants): não entra no próprio grupo.
  if (group.ownerId === String(userId)) return { isOwner: true };
  const { values, errors, data } = parseJoinForm(body);
  if (!data) return { values, errors };
  // Idempotente: quem já participa mantém o apelido antigo.
  try {
    await membershipsRepo.insertMembership(userId, group.id, data.nickname);
  } catch (err) {
    // Conta ou grupo apagado entre a leitura e o INSERT (FK): não vira 500.
    if (err?.code === FK_VIOLATION) return { notFound: true };
    throw err;
  }
  return { joined: true };
}

export function leaveGroup(slug, userId) {
  return membershipsRepo.deleteMembership(userId, slug);
}

export function listJoinedSlugs(userId) {
  return membershipsRepo.listJoinedSlugs(userId);
}
