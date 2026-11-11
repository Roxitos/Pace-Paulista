import { pool } from '../../db/pool.js';
import { ZONA_ORDEM } from '../../domain/constants.js';

// Colunas listadas uma a uma: este SELECT é o contrato `Group` das views (specs 004–007).
// De users só sai display_name; email, password_hash e role nunca deixam o repo.
const LIST_PUBLISHED = `
  SELECT g.slug,
         g.name,
         g.zone,
         g.location,
         g.meeting_point,
         g.days,
         to_char(g.start_time, 'HH24:MI') AS start_time,
         g.pace_min_s,
         g.pace_max_s,
         g.distance,
         g.level,
         (g.base_participants + COUNT(m.user_id))::int AS participants,
         g.description,
         g.profile_tags,
         g.contact,
         g.is_demo,
         u.display_name AS owner_name,
         g.map_pin
    FROM groups g
    LEFT JOIN users u ON u.id = g.owner_id
    LEFT JOIN memberships m ON m.group_id = g.id
   WHERE g.status = 'published'
   GROUP BY g.id, u.display_name
   ORDER BY array_position($1::text[], g.zone), g.name, g.slug`;

export async function listPublished() {
  const { rows } = await pool.query(LIST_PUBLISHED, [ZONA_ORDEM]);
  return rows;
}
