import { describe, expect, it } from 'vitest';
import { parseSignup } from '../../src/modules/auth/auth.schemas.js';

const ok = { nome: 'Ana', email: 'ana@x.com', senha: 'abcdefg!' };
const errorsOf = (patch) => parseSignup({ ...ok, ...patch }).errors;

describe('parseSignup', () => {
  it('aceita entrada válida e monta data e values', () => {
    const r = parseSignup(ok);
    expect(r.errors).toEqual({});
    expect(r.data).toEqual({ displayName: 'Ana', email: 'ana@x.com', password: 'abcdefg!' });
    expect(r.values).toEqual({ nome: 'Ana', email: 'ana@x.com', next: '' });
  });

  it('values nunca contém a senha', () => {
    expect(parseSignup(ok).values).not.toHaveProperty('senha');
  });

  it('next inseguro vira vazio e next interno é mantido', () => {
    expect(parseSignup({ ...ok, next: '//evil.com' }).values.next).toBe('');
    expect(parseSignup({ ...ok, next: '/grupos/x#participar' }).values.next).toBe(
      '/grupos/x#participar',
    );
  });

  describe('nome', () => {
    it('faz trim antes de medir', () => {
      expect(errorsOf({ nome: '   ' }).nome).toBe('Informe um nome com pelo menos 2 caracteres.');
      expect(errorsOf({ nome: ' a ' }).nome).toBe('Informe um nome com pelo menos 2 caracteres.');
      expect(parseSignup({ ...ok, nome: '  Ana  ' }).values.nome).toBe('Ana');
    });
    it('mede em code points: 40 emojis passam, 41 não', () => {
      expect(errorsOf({ nome: '😀'.repeat(40) }).nome).toBeUndefined();
      expect(errorsOf({ nome: 'a'.repeat(41) }).nome).toBe('Use no máximo 40 caracteres.');
    });
  });

  describe('email', () => {
    it.each(['joão@x.com', 'Ana@Clube.com.br'])('aceita %s', (email) => {
      expect(errorsOf({ email }).email).toBeUndefined();
    });
    it.each(['ana', 'ana@x', 'a b@x.com', `${'a'.repeat(250)}@x.com`])('recusa %s', (email) => {
      expect(errorsOf({ email }).email).toBe('Informe um e-mail válido.');
    });
  });

  describe('senha', () => {
    it.each(['abcdefg!', 'senha com espaço', 'abc_defgh'])('aceita %s', (senha) => {
      expect(errorsOf({ senha }).senha).toBeUndefined();
    });
    it.each(['abcdef!', `${'a'.repeat(72)}!`, '😀'.repeat(30)])(
      'recusa por tamanho: %s',
      (senha) => {
        expect(errorsOf({ senha }).senha).toBe('A senha precisa ter de 8 a 72 caracteres.');
      },
    );
    it.each(['abcdefgh1', 'açúcarél'])('recusa sem caractere especial: %s', (senha) => {
      expect(errorsOf({ senha }).senha).toBe(
        'A senha precisa de pelo menos 1 caractere especial (ex.: ! @ # $ %).',
      );
    });
    it('não faz trim', () => {
      expect(errorsOf({ senha: '       !' }).senha).toBeUndefined();
    });
  });

  it('erros saem na ordem nome, email, senha e data é null', () => {
    const r = parseSignup({ nome: '', email: 'x', senha: '' });
    expect(Object.keys(r.errors)).toEqual(['nome', 'email', 'senha']);
    expect(r.data).toBeNull();
  });

  it('não lança com body malformado e usa o primeiro valor de array', () => {
    expect(parseSignup({ ...ok, nome: ['Bia', 'x'] }).values.nome).toBe('Bia');
    expect(Object.keys(parseSignup({ nome: { a: 1 }, email: 5 }).errors)).toEqual([
      'nome',
      'email',
      'senha',
    ]);
    expect(() => parseSignup(undefined)).not.toThrow();
    expect(() => parseSignup(null)).not.toThrow();
  });
});
