import { describe, expect, it } from 'vitest';
import { parseGroupForm } from '../../src/modules/groups/groups.schemas.js';

const valido = {
  nome: '  Corredores do Sul ',
  zona: 'sul',
  local: 'Parque Ibirapuera',
  ponto: '',
  dias: ['qua', 'seg', 'qua'],
  horario: '06:30',
  distancia: '',
  paceMin: '5:30',
  paceMax: '6:30',
  nivel: 'intermediario',
  participantes: '',
  descricao: 'Treino em grupo com aquecimento e alongamento.',
  contato: '@corredoresdosul',
  organizador: 'on',
};

describe('parseGroupForm', () => {
  it('aceita o form completo e normaliza os dados', () => {
    const { errors, data } = parseGroupForm(valido);
    expect(errors).toEqual({});
    expect(data).toEqual({
      name: 'Corredores do Sul',
      zone: 'sul',
      location: 'Parque Ibirapuera',
      meetingPoint: 'Combinado no grupo',
      days: ['seg', 'qua'],
      startTime: '06:30',
      distance: null,
      paceMinS: 330,
      paceMaxS: 390,
      level: 'intermediario',
      baseParticipants: 1,
      description: 'Treino em grupo com aquecimento e alongamento.',
      contact: '@corredoresdosul',
    });
  });

  it('form vazio gera um erro por campo obrigatório, na ordem do form', () => {
    const { errors, data } = parseGroupForm({});
    expect(data).toBeNull();
    expect(errors).toEqual({
      nome: 'Informe um nome com pelo menos 3 caracteres.',
      zona: 'Escolha a zona do grupo.',
      local: 'Informe o local de encontro.',
      dias: 'Selecione pelo menos um dia.',
      horario: 'Informe o horário do treino.',
      paceMin: 'Use o formato 5:30, entre 3:00 e 12:00.',
      paceMax: 'Use o formato 6:30, entre 3:00 e 12:00.',
      nivel: 'Selecione o nível do grupo.',
      descricao: 'A descrição precisa de pelo menos 30 caracteres (faltam 30).',
      contato: 'Informe um contato público do grupo.',
      organizador: 'Confirme que você organiza o grupo.',
    });
  });

  it('recusa máximos com a mensagem nova', () => {
    const { errors } = parseGroupForm({
      ...valido,
      nome: 'a'.repeat(51),
      local: 'a'.repeat(81),
      ponto: 'a'.repeat(101),
      distancia: 'a'.repeat(31),
      descricao: 'a'.repeat(401),
      contato: 'a'.repeat(81),
    });
    expect(Object.keys(errors)).toEqual([
      'nome',
      'local',
      'ponto',
      'distancia',
      'descricao',
      'contato',
    ]);
    expect(errors.nome).toBe('Use no máximo 50 caracteres.');
    expect(errors.descricao).toBe('Use no máximo 400 caracteres.');
  });

  it('recusa pace mais lento menor ou igual ao mais rápido', () => {
    const { errors } = parseGroupForm({ ...valido, paceMin: '6:30', paceMax: '6:30' });
    expect(errors).toEqual({ paceMax: 'O pace mais lento precisa ser maior que o mais rápido.' });
  });

  it('recusa horário 24:00 e pace fora de 3:00–12:00', () => {
    const { errors } = parseGroupForm({ ...valido, horario: '24:00', paceMin: '2:59' });
    expect(Object.keys(errors)).toEqual(['horario', 'paceMin']);
  });

  it('participantes inválido ou fora de 1–999 vira 1; válido é mantido', () => {
    expect(parseGroupForm({ ...valido, participantes: 'abc' }).data.baseParticipants).toBe(1);
    expect(parseGroupForm({ ...valido, participantes: '1000' }).data.baseParticipants).toBe(1);
    expect(parseGroupForm({ ...valido, participantes: '15' }).data.baseParticipants).toBe(15);
  });

  it('entradas hostis não lançam: array, NUL, só espaços, valores desconhecidos', () => {
    const { values, errors } = parseGroupForm({
      ...valido,
      nome: ['a\0b', 'c'],
      descricao: ' '.repeat(40),
      zona: 'marte',
      nivel: 'x',
      dias: 'xyz',
    });
    expect(values.nome).toBe('ab');
    expect(Object.keys(errors)).toEqual(['nome', 'zona', 'dias', 'nivel', 'descricao']);
    expect(parseGroupForm(null).data).toBeNull();
  });

  it('normaliza para NFC e reexibe o texto após o trim', () => {
    const { values } = parseGroupForm({ ...valido, nome: ' Café Run ' });
    expect(values.nome).toBe('Café Run');
    expect(values.dias).toEqual(['seg', 'qua']);
    expect(values.organizador).toBe(true);
  });

  // Hardener: o browser conta a quebra de linha como 1 no maxlength, mas envia CRLF (2).
  it('quebra de linha CRLF conta como 1 caractere na descrição', () => {
    const linha = 'a'.repeat(79);
    const descricao = Array(5).fill(linha).join('\r\n'); // 395 + 4 quebras = 399 no browser
    const { errors, data } = parseGroupForm({ ...valido, descricao });
    expect(errors).toEqual({});
    expect(data.description).toBe(Array(5).fill(linha).join('\n'));
  });

  // Hardener: caractere invisível/espaço repetido não pode burlar o nome único nem o mínimo.
  it('tira caracteres invisíveis e junta espaços nos campos de uma linha', () => {
    const { values } = parseGroupForm({ ...valido, nome: 'Correria​  do ‮Carmo\n' });
    expect(values.nome).toBe('Correria do Carmo');
    const vazio = parseGroupForm({ ...valido, nome: '​‍⁠﻿' });
    expect(vazio.errors.nome).toBe('Informe um nome com pelo menos 3 caracteres.');
    // Emoji com ZWJ continua inteiro.
    expect(parseGroupForm({ ...valido, nome: 'Run 👩‍👩‍👧' }).values.nome).toBe('Run 👩‍👩‍👧');
  });
});
