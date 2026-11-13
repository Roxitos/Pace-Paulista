import { describe, expect, it } from 'vitest';
import { parseLogin, parseSignup } from '../../src/modules/auth/auth.schemas.js';

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
    it('remove NUL (o Postgres recusa com 22021)', () => {
      expect(parseSignup({ ...ok, nome: 'A\0na' }).values.nome).toBe('Ana');
      expect(errorsOf({ nome: '\0a\0' }).nome).toBe('Informe um nome com pelo menos 2 caracteres.');
    });
  });

  describe('email', () => {
    it.each(['joão@x.com', 'Ana@Clube.com.br'])('aceita %s', (email) => {
      expect(errorsOf({ email }).email).toBeUndefined();
    });
    it.each([
      'ana',
      'ana@x',
      'a b@x.com',
      `${'a'.repeat(250)}@x.com`,
      'a\0b@x.com',
      'a\u0007@x.com',
    ])('recusa %s', (email) => {
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

describe('parseLogin', () => {
  const okLogin = { email: ' ANA@x.com ', senha: 'qualquer' };

  it('só exige preenchimento: trim no e-mail, senha intacta e fora de values', () => {
    const r = parseLogin({ ...okLogin, next: '/grupos' });
    expect(r.errors).toEqual({});
    expect(r.data).toEqual({ email: 'ANA@x.com', password: 'qualquer' });
    expect(r.values).toEqual({ email: 'ANA@x.com', next: '/grupos' });
  });

  it('campos vazios, arrays e senha só de espaços', () => {
    expect(parseLogin({}).errors).toEqual({
      email: 'Informe seu e-mail.',
      senha: 'Informe sua senha.',
    });
    expect(parseLogin({ email: ['a'], senha: { x: 1 } }).data).toBeNull();
    expect(parseLogin(undefined).data).toBeNull();
    expect(parseLogin({ email: 'a@x.com', senha: '   ' }).errors).toEqual({});
  });
});
