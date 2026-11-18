import { describe, expect, it } from 'vitest';
import { parseJoinForm } from '../../src/modules/memberships/memberships.schemas.js';

describe('parseJoinForm', () => {
  it('aceita apelido válido, com trim e NFC', () => {
    const { values, errors, data } = parseJoinForm({ apelido: '  José  ', ok: 'on' });
    expect(errors).toEqual({});
    expect(values).toEqual({ apelido: 'José', ok: true });
    expect(data).toEqual({ nickname: 'José' });
  });

  it('apelido vazio ou só espaços é válido e vira null', () => {
    for (const apelido of ['', '   ']) {
      const { errors, data } = parseJoinForm({ apelido, ok: 'on' });
      expect(errors).toEqual({});
      expect(data).toEqual({ nickname: null });
    }
  });

  it('recusa apelido de 1 caractere e orientações sem aceite, nessa ordem', () => {
    const { errors, data } = parseJoinForm({ apelido: ' a ' });
    expect(Object.keys(errors)).toEqual(['apelido', 'ok']);
    expect(errors.apelido).toBe('Use pelo menos 2 letras ou deixe em branco.');
    expect(errors.ok).toBe('Confirme que leu as orientações.');
    expect(data).toBeNull();
  });

  it('aceita 40 code points e recusa 41', () => {
    expect(parseJoinForm({ apelido: '😀'.repeat(40), ok: 'on' }).errors).toEqual({});
    expect(parseJoinForm({ apelido: 'a'.repeat(41), ok: 'on' }).errors.apelido).toBe(
      'Use no máximo 40 caracteres.',
    );
  });

  it('usa o 1º valor repetido, ignora NUL e trata não-string como vazio', () => {
    expect(parseJoinForm({ apelido: ['Ana', 'bb'], ok: ['on'] }).values).toEqual({
      apelido: 'Ana',
      ok: true,
    });
    expect(parseJoinForm({ apelido: 'A\0na', ok: 'on' }).values.apelido).toBe('Ana');
    expect(parseJoinForm({ apelido: { a: 1 }, ok: { a: 1 } }).values).toEqual({
      apelido: '',
      ok: false,
    });
    expect(parseJoinForm(undefined).errors.apelido).toBeUndefined();
  });
});
