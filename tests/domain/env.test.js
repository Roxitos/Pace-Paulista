import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

describe('parseEnv', () => {
  it('aplica os valores padrão', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      TZ_APP: 'America/Sao_Paulo',
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
});
