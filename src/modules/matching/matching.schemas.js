import { z } from 'zod';
import { DIA_ORDEM, NIVEIS, PERIODOS, ZONA_ORDEM } from '../../domain/constants.js';
import { parsePace } from '../../domain/pace.js';

export const MATCH_FIELDS = ['zona', 'pace', 'dias', 'nivel', 'periodo'];

const ZONA_OPCOES = [...ZONA_ORDEM, 'qualquer'];
const NIVEL_OPCOES = Object.keys(NIVEIS);
const PERIODO_OPCOES = Object.keys(PERIODOS);

// Mensagens do submitMatch do protótipo.
const MSG = {
  zona: 'Escolha uma zona ou "Qualquer zona".',
  paceVazio: 'Informe seu pace aproximado.',
  paceFormato: 'Use o formato 6:00, entre 3:00 e 12:00 min/km.',
  dias: 'Selecione pelo menos um dia.',
  nivel: 'Escolha seu nível.',
};

// Ordem de inserção dos erros = ordem do showErrors do protótipo (o 1º recebe o foco).
const ERROR_ORDER = ['zona', 'pace', 'dias', 'nivel'];

// Roda sobre os valores já normalizados: chave inválida chega como '' e cai na mensagem do campo.
const matchSchema = z.object({
  zona: z.enum(ZONA_OPCOES, { error: MSG.zona }),
  pace: z
    .string()
    .min(1, { error: MSG.paceVazio, abort: true })
    .refine((s) => parsePace(s) !== null, { error: MSG.paceFormato }),
  dias: z.array(z.enum(DIA_ORDEM)).min(1, { error: MSG.dias }),
  nivel: z.enum(NIVEL_OPCOES, { error: MSG.nivel }),
});

function isObject(input) {
  return input !== null && typeof input === 'object';
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf(value, allowed) {
  const s = first(value);
  return typeof s === 'string' && allowed.includes(s) ? s : '';
}

export function hasMatchParams(input) {
  return isObject(input) && MATCH_FIELDS.some((key) => Object.hasOwn(input, key));
}

/**
 * Normaliza req.query do /encontrar e valida. Nunca lança.
 * `values` reexibe o form; `errors` traz só os campos com erro, na ordem zona, pace, dias, nivel;
 * `q` (entrada de calcMatch, pace em segundos) só existe quando não há erro.
 */
export function parseMatchForm(input) {
  const src = isObject(input) ? input : {};
  const get = (key) => (Object.hasOwn(src, key) ? src[key] : undefined);

  const pace = first(get('pace'));
  const diasParam = get('dias');
  const diasList = Array.isArray(diasParam) ? diasParam : [diasParam];
  const values = {
    zona: oneOf(get('zona'), ZONA_OPCOES),
    pace: typeof pace === 'string' ? pace.trim() : '',
    dias: DIA_ORDEM.filter((d) => diasList.includes(d)),
    nivel: oneOf(get('nivel'), NIVEL_OPCOES),
    periodo: oneOf(get('periodo'), PERIODO_OPCOES),
  };

  const result = matchSchema.safeParse(values);
  const errors = {};
  if (!result.success) {
    for (const key of ERROR_ORDER) {
      const issue = result.error.issues.find((i) => i.path[0] === key);
      if (issue) errors[key] = issue.message;
    }
  }

  const q = result.success ? { ...values, pace: parsePace(values.pace) } : null;
  return { values, errors, q };
}
