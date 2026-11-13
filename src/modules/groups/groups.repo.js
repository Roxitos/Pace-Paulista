import { pool } from '../../db/pool.js';
import { PACE_FAIXAS, PERIODOS, ZONA_ORDEM } from '../../domain/constants.js';
import { EMPTY_FILTERS, escapeLike, periodRange } from '../../domain/filters.js';

// Colunas listadas uma a uma: este SELECT é o contrato `Group` das views (specs 004–007).
// De users só sai display_name; email, password_hash e role nunca deixam o repo.
const SELECT_PUBLISHED = `
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
         g.owner_id::text AS owner_id,
         g.map_pin
    FROM groups g
    LEFT JOIN users u ON u.id = g.owner_id
    LEFT JOIN memberships m ON m.group_id = g.id`;

// O GROUP BY acompanha os JOINs de SELECT_PUBLISHED; fica aqui para as consultas não divergirem.
function selectPublished(where) {
  return `${SELECT_PUBLISHED}
   WHERE ${where}
   GROUP BY g.id, u.display_name`;
}

// Só o texto das condições é montado aqui; todo valor de filtro vai como parâmetro $n.
// filters vem de parseFilters, mas as chaves de PACE_FAIXAS/PERIODOS são conferidas de novo
// porque este é o último ponto antes do SQL.
function buildWhere(filters, params) {
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const contains = (column, term) => `${column} ILIKE ${add(`%${escapeLike(term)}%`)} ESCAPE '\\'`;
  const where = ["g.status = 'published'"];

  if (Array.isArray(filters.zonas) && filters.zonas.length > 0) {
    where.push(`g.zone = ANY(${add(filters.zonas)}::text[])`);
  }
  if (filters.nome) where.push(contains('g.name', filters.nome));
  if (filters.local) where.push(contains('g.location', filters.local));
  if (filters.dia) where.push(`${add(filters.dia)}::text = ANY(g.days)`);
  if (filters.periodo && Object.hasOwn(PERIODOS, filters.periodo)) {
    const { from, to } = periodRange(filters.periodo);
    where.push(`g.start_time >= ${add(from)}::time`);
    if (to !== null) where.push(`g.start_time < ${add(to)}::time`);
  }
  // A faixa do grupo precisa cruzar a escolhida; só encostar na borda não basta.
  if (filters.pace && Object.hasOwn(PACE_FAIXAS, filters.pace)) {
    const { min, max } = PACE_FAIXAS[filters.pace];
    where.push(`g.pace_min_s < ${add(max)}::int AND g.pace_max_s > ${add(min)}::int`);
  }
  if (filters.nivel) where.push(`g.level = ${add(filters.nivel)}::text`);
  return where.join('\n     AND ');
}

export async function listPublished(filters = EMPTY_FILTERS) {
  const params = [ZONA_ORDEM];
  const sql = `${selectPublished(buildWhere(filters, params))}
   ORDER BY array_position($1::text[], g.zone), g.name, g.slug`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function findPublishedBySlug(slug) {
  const { rows } = await pool.query(selectPublished("g.slug = $1 AND g.status = 'published'"), [
    slug,
  ]);
  return rows[0] ?? null;
}

// Ordem de cadastro (P3 da spec 008): o /encontrar desempata como o protótipo, pela ordem
// da lista (DEMO na ordem do seed, depois os grupos novos).
export async function listPublishedByCreation() {
  const { rows } = await pool.query(`${selectPublished("g.status = 'published'")}
   ORDER BY g.id`);
  return rows;
}

// citext: sem diferença de caixa. Considera todos os status, pois o UNIQUE do banco também.
export async function nameExists(name) {
  const { rows } = await pool.query(
    'SELECT EXISTS (SELECT 1 FROM groups WHERE name = $1) AS found',
    [name],
  );
  return rows[0].found;
}

export async function findSlugsLike(base) {
  const { rows } = await pool.query(
    "SELECT slug FROM groups WHERE slug = $1 OR slug LIKE $2 ESCAPE '\\'",
    [base, `${base}-%`],
  );
  return rows.map((r) => r.slug);
}

// Não captura erro: o service trata 23505. status e profile_tags saem do DEFAULT do banco.
export async function insertGroup(data, ownerId, slug) {
  const { rows } = await pool.query(
    `INSERT INTO groups (slug, name, zone, location, meeting_point, days, start_time,
                         pace_min_s, pace_max_s, distance, level, base_participants,
                         description, contact, is_demo, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6::text[], $7::time, $8, $9, $10, $11, $12, $13, $14, false, $15)
     RETURNING slug`,
    [
      slug,
      data.name,
      data.zone,
      data.location,
      data.meetingPoint,
      data.days,
      data.startTime,
      data.paceMinS,
      data.paceMaxS,
      data.distance,
      data.level,
      data.baseParticipants,
      data.description,
      data.contact,
      ownerId,
    ],
  );
  return rows[0];
}
