import { describe, expect, it } from 'vitest';
import { connectionStringFor, describeDatabaseUrl, parseEnv } from '../../src/config/env.js';

describe('parseEnv', () => {
  it('aplica os valores padrão', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      TZ_APP: 'America/Sao_Paulo',
      DATABASE_URL: 'postgres://pace:pace@localhost:5432/pace_paulista',
      DATABASE_URL_TEST: 'postgres://pace:pace@localhost:5432/pace_paulista_test',
      SESSION_SECRET: 'dev-inseguro-nao-usar-em-producao',
    });
  });

  it('converte PORT de string para número', () => {
    expect(parseEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('recusa PORT não numérica citando a variável', () => {
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('recusa PORT fora de 1–65535', () => {
    expect(() => parseEnv({ PORT: '70000' })).toThrow(/PORT/);
  });

  it('recusa NODE_ENV desconhecido', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('lista todas as variáveis inválidas', () => {
    let message = '';
    try {
      parseEnv({ PORT: 'abc', NODE_ENV: 'staging' });
    } catch (err) {
      message = err.message;
    }
    expect(message).toContain('PORT');
    expect(message).toContain('NODE_ENV');
  });

  it('recusa TZ_APP que não é um fuso IANA válido', () => {
    expect(() => parseEnv({ TZ_APP: 'Marte/Olympus' })).toThrow(/TZ_APP/);
  });

  it('aceita outro fuso IANA válido em TZ_APP', () => {
    expect(parseEnv({ TZ_APP: 'UTC' }).TZ_APP).toBe('UTC');
  });

  it('recusa DATABASE_URL_TEST igual a DATABASE_URL', () => {
    const url = 'postgres://pace:pace@localhost:5432/pace_paulista';
    expect(() => parseEnv({ DATABASE_URL: url, DATABASE_URL_TEST: url })).toThrow(
      /DATABASE_URL_TEST/,
    );
  });

  it.each([
    ['outro protocolo', 'postgresql://pace:pace@localhost:5432/pace_paulista'],
    ['porta omitida', 'postgres://pace:pace@localhost/pace_paulista'],
    ['outras credenciais e parâmetros', 'postgres://outro:x@LOCALHOST:5432/pace_paulista?a=1'],
  ])('recusa DATABASE_URL_TEST que aponta para o mesmo banco (%s)', (_caso, test) => {
    const url = 'postgres://pace:pace@localhost:5432/pace_paulista';
    expect(() => parseEnv({ DATABASE_URL: url, DATABASE_URL_TEST: test })).toThrow(
      /DATABASE_URL_TEST/,
    );
  });

  it('recusa URL de banco sem nome do banco', () => {
    expect(() => parseEnv({ DATABASE_URL: 'postgres://pace:pace@localhost:5432/' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('aceita o protocolo postgresql:', () => {
    const url = 'postgresql://u:p@db.exemplo:6543/app';
    expect(parseEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it('trata SESSION_SECRET vazio como ausente em dev e test', () => {
    expect(parseEnv({ SESSION_SECRET: '' }).SESSION_SECRET).toBe(
      'dev-inseguro-nao-usar-em-producao',
    );
    expect(parseEnv({ NODE_ENV: 'test', SESSION_SECRET: '' }).SESSION_SECRET).toBe(
      'dev-inseguro-nao-usar-em-producao',
    );
  });

  it('trata DATABASE_URL vazio como ausente em dev', () => {
    expect(parseEnv({ DATABASE_URL: '' }).DATABASE_URL).toBe(
      'postgres://pace:pace@localhost:5432/pace_paulista',
    );
  });
});

describe('parseEnv em produção', () => {
  const secret = 'k3J9x!vQ2mZ7pL0wR5tY8uB1nC4eH6aS';
  const url = 'postgres://app:senha-super-secreta@db.exemplo:5432/pace';
  const prod = (overrides) => ({
    NODE_ENV: 'production',
    DATABASE_URL: url,
    SESSION_SECRET: secret,
    ...overrides,
  });

  function messageOf(source) {
    try {
      parseEnv(source);
    } catch (err) {
      return err.message;
    }
    return '';
  }

  it('aceita URL válida e segredo aleatório de 32+ caracteres', () => {
    const parsed = parseEnv(prod());
    expect(parsed.DATABASE_URL).toBe(url);
    expect(parsed.SESSION_SECRET).toBe(secret);
  });

  it('recusa sem DATABASE_URL', () => {
    expect(messageOf(prod({ DATABASE_URL: undefined }))).toMatch(/DATABASE_URL/);
  });

  it('recusa DATABASE_URL com protocolo mysql:', () => {
    expect(
      messageOf(prod({ DATABASE_URL: 'mysql://app:senha-super-secreta@db:3306/pace' })),
    ).toMatch(/DATABASE_URL/);
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['com 31 caracteres', 'a'.repeat(31)],
    ['igual ao placeholder do .env.example', 'troque-por-uma-string-longa-e-aleatoria'],
    ['igual ao default de desenvolvimento', 'dev-inseguro-nao-usar-em-producao'],
  ])('recusa SESSION_SECRET %s', (_caso, value) => {
    expect(messageOf(prod({ SESSION_SECRET: value }))).toMatch(/SESSION_SECRET/);
  });

  it('não expõe a senha da URL nem o segredo na mensagem de erro', () => {
    const message = messageOf(
      prod({
        DATABASE_URL: 'mysql://app:senha-super-secreta@db:3306/pace',
        SESSION_SECRET: 'curto-demais',
      }),
    );
    expect(message).toBe('Variáveis de ambiente inválidas: DATABASE_URL, SESSION_SECRET');
    expect(message).not.toContain('senha-super-secreta');
    expect(message).not.toContain('curto-demais');
  });
});

describe('connectionStringFor', () => {
  const env = { DATABASE_URL: 'postgres://a/dev', DATABASE_URL_TEST: 'postgres://a/dev_test' };

  it('usa DATABASE_URL_TEST em test', () => {
    expect(connectionStringFor({ ...env, NODE_ENV: 'test' })).toBe('postgres://a/dev_test');
  });

  it.each(['development', 'production'])('usa DATABASE_URL em %s', (nodeEnv) => {
    expect(connectionStringFor({ ...env, NODE_ENV: nodeEnv })).toBe('postgres://a/dev');
  });
});

describe('describeDatabaseUrl', () => {
  it('mostra host, porta e banco sem credenciais', () => {
    expect(describeDatabaseUrl('postgres://pace:pace@localhost:5432/pace_paulista')).toBe(
      'localhost:5432/pace_paulista',
    );
  });

  it('usa a porta 5432 quando a URL não tem porta', () => {
    const described = describeDatabaseUrl('postgresql://app:segredo@db.exemplo/pace');
    expect(described).toBe('db.exemplo:5432/pace');
    expect(described).not.toContain('segredo');
  });
});
