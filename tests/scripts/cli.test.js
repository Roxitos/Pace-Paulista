import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cliErrorMessage, isConnectionFailure, isMain } from '../../scripts/cli.js';

describe('isMain', () => {
  let dir;
  let script;
  let linkedScript;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'pace-cli-'));
    await writeFile(path.join(dir, 'script.js'), '');
    script = path.join(dir, 'script.js');
    // Junction no Windows (não exige admin); link simbólico de diretório no Linux.
    await symlink(dir, path.join(dir, '..', `${path.basename(dir)}-link`), 'junction');
    linkedScript = path.join(`${dir}-link`, 'script.js');
  });

  afterAll(async () => {
    await rm(`${dir}-link`, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  });

  it('reconhece o próprio arquivo como ponto de entrada', () => {
    expect(isMain(pathToFileURL(script).href, script)).toBe(true);
  });

  // O Node resolve links no import.meta.url do script principal, mas não em process.argv[1]:
  // sem isto, `npm run migrate` num diretório com link terminava em silêncio, com código 0.
  it('reconhece o arquivo quando executado por um caminho com link', () => {
    expect(isMain(pathToFileURL(script).href, linkedScript)).toBe(true);
  });

  it('não confunde com outro arquivo', () => {
    expect(isMain(pathToFileURL(script).href, path.join(dir, 'outro.js'))).toBe(false);
  });
});

describe('isConnectionFailure', () => {
  it.each([
    [
      'conexão recusada',
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    ],
    ['timeout de conexão do pool', new Error('Connection terminated due to connection timeout')],
    ['timeout esperando vaga no pool', new Error('timeout exceeded when trying to connect')],
  ])('reconhece %s', (_caso, err) => {
    expect(isConnectionFailure(err)).toBe(true);
  });

  it.each([
    [
      'lock timeout do Postgres',
      Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' }),
    ],
    [
      'statement timeout do Postgres',
      Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' }),
    ],
    [
      'migration que falhou por timeout',
      new Error('Falha na migration 006_x.sql: canceling statement due to lock timeout'),
    ],
  ])('não confunde %s com Postgres fora do ar', (_caso, err) => {
    expect(isConnectionFailure(err)).toBe(false);
  });
});

describe('cliErrorMessage', () => {
  it('mantém a mensagem real de uma migration que falhou por timeout', () => {
    const err = new Error('Falha na migration 006_x.sql: canceling statement due to lock timeout');
    expect(cliErrorMessage(err, 'localhost:5432/pace_paulista')).toBe(err.message);
  });

  it('orienta a subir o banco quando a conexão é recusada', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    expect(cliErrorMessage(err, 'localhost:5432/pace_paulista')).toBe(
      'Não foi possível conectar ao Postgres em localhost:5432/pace_paulista. Ele está de pé? Rode npm run db:up.',
    );
  });
});
