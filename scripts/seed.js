import { DEMO_GROUPS } from '../db/seeds/demo-groups.js';
import { cliErrorMessage, isMain } from './cli.js';

const BLOCKED_IN_PRODUCTION = 'Seed de demonstração bloqueado em produção (NODE_ENV=production).';

const INSERT_GROUP = `
  INSERT INTO groups (slug, name, zone, location, meeting_point, days, start_time, pace_min_s,
                      pace_max_s, distance, level, base_participants, description, profile_tags,
                      map_pin, is_demo, status)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  ON CONFLICT (slug) DO NOTHING`;

export async function runSeed({ pool, nodeEnv, groups = DEMO_GROUPS }) {
  // O comando de release (migrate && seed) não pode publicar grupos fictícios em produção.
  if (nodeEnv === 'production') throw new Error(BLOCKED_IN_PRODUCTION);

  // Import dinâmico: pool.js valida o ambiente ao carregar, e em produção sem DATABASE_URL
  // o erro de ambiente esconderia a mensagem de bloqueio acima.
  const { tx } = await import('../src/db/pool.js');
  const inserted = await tx(async (client) => {
    let count = 0;
    for (const group of groups) {
      const result = await client.query(INSERT_GROUP, [
        group.slug,
        group.name,
        group.zone,
        group.location,
        group.meeting_point,
        group.days,
        group.start_time,
        group.pace_min_s,
        group.pace_max_s,
        group.distance,
        group.level,
        group.base_participants,
        group.description,
        group.profile_tags,
        group.map_pin,
        group.is_demo,
        'published',
      ]);
      count += result.rowCount;
    }
    return count;
  }, pool);
  return { inserted, total: groups.length };
}

async function main() {
  await import('dotenv/config');
  // Bloqueia antes de validar o ambiente (mesmo motivo do import dinâmico em runSeed).
  if (process.env.NODE_ENV === 'production') {
    console.error(BLOCKED_IN_PRODUCTION);
    process.exitCode = 1;
    return;
  }

  const { connectionStringFor, describeDatabaseUrl, env } = await import('../src/config/env.js');
  const { createPool } = await import('../src/db/pool.js');
  const connectionString = connectionStringFor(env);
  const target = describeDatabaseUrl(connectionString);
  const pool = createPool(connectionString);
  try {
    const { inserted, total } = await runSeed({ pool, nodeEnv: env.NODE_ENV });
    console.log(
      `Seed: ${inserted} de ${total} grupos demo inseridos (${total - inserted} já existiam).`,
    );
  } catch (err) {
    console.error(
      err.code === '42P01'
        ? 'Tabela groups não encontrada. Rode npm run migrate antes do seed.'
        : cliErrorMessage(err, target),
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (isMain(import.meta.url)) await main();
