import { DIA_ORDEM, NIVEIS, ZONA_ORDEM } from '../../domain/constants.js';
import { parsePace } from '../../domain/pace.js';

const DEFAULT_PONTO = 'Combinado no grupo';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const MSG = {
  nomeMin: 'Informe um nome com pelo menos 3 caracteres.',
  zona: 'Escolha a zona do grupo.',
  localMin: 'Informe o local de encontro.',
  dias: 'Selecione pelo menos um dia.',
  horario: 'Informe o horário do treino.',
  paceMin: 'Use o formato 5:30, entre 3:00 e 12:00.',
  paceMax: 'Use o formato 6:30, entre 3:00 e 12:00.',
  paceOrdem: 'O pace mais lento precisa ser maior que o mais rápido.',
  nivel: 'Selecione o nível do grupo.',
  contatoMin: 'Informe um contato público do grupo.',
  organizador: 'Confirme que você organiza o grupo.',
};
const maxMsg = (n) => `Use no máximo ${n} caracteres.`;

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

// Invisíveis (ZWSP, BOM, controles bidi…) burlariam o nome único e o mínimo de caracteres.
// O ZWJ só fica dentro de emoji composto (👩‍👩‍👧).
const INVISIBLE_RE = /[\p{Cf}--‍]|‍(?!\p{Extended_Pictographic})/gv;
// Campo de uma linha: espaço repetido, tab ou quebra viram um espaço (no HTML ficariam iguais).
const SPACES_RE = /[\s\p{Cc}]+/gu;
// Na descrição a quebra de linha fica; outros controles saem.
const CONTROL_RE = /[\p{Cc}--[\n\t]]/gv;

// NUL derrubaria o INSERT (22021); tamanhos em code points, como o char_length do banco.
function text(value, { multiline = false } = {}) {
  const v = first(value);
  if (typeof v !== 'string') return '';
  // O browser conta CRLF como 1 no maxlength do textarea, mas envia 2 caracteres.
  const s = v.replaceAll('\0', '').replace(/\r\n?/g, '\n').replace(INVISIBLE_RE, '');
  const clean = multiline ? s.replace(CONTROL_RE, '') : s.replace(SPACES_RE, ' ');
  return clean.trim().normalize('NFC');
}
const len = (s) => [...s].length;

function list(value) {
  const items = Array.isArray(value) ? value : [value];
  return items.filter((v) => typeof v === 'string');
}

/**
 * Normaliza o body do POST /grupos e valida. Nunca lança.
 * `values` reexibe o form; `errors` na ordem do form, uma mensagem por campo;
 * `data` só existe quando não há erro.
 */
export function parseGroupForm(body) {
  const src = body !== null && typeof body === 'object' ? body : {};
  const nome = text(src.nome);
  const zona = text(src.zona);
  const local = text(src.local);
  const ponto = text(src.ponto);
  const horario = text(src.horario);
  const distancia = text(src.distancia);
  const paceMin = text(src.paceMin);
  const paceMax = text(src.paceMax);
  const nivel = text(src.nivel);
  const participantes = text(src.participantes);
  const descricao = text(src.descricao, { multiline: true });
  const contato = text(src.contato);
  const organizador = text(src.organizador) !== '';
  const dias = DIA_ORDEM.filter((d) => list(src.dias).includes(d));

  const errors = {};
  if (len(nome) < 3) errors.nome = MSG.nomeMin;
  else if (len(nome) > 50) errors.nome = maxMsg(50);
  if (!ZONA_ORDEM.includes(zona)) errors.zona = MSG.zona;
  if (len(local) < 3) errors.local = MSG.localMin;
  else if (len(local) > 80) errors.local = maxMsg(80);
  if (len(ponto) > 100) errors.ponto = maxMsg(100);
  if (dias.length === 0) errors.dias = MSG.dias;
  if (!TIME_RE.test(horario)) errors.horario = MSG.horario;
  if (len(distancia) > 30) errors.distancia = maxMsg(30);
  const paceMinS = parsePace(paceMin);
  const paceMaxS = parsePace(paceMax);
  if (paceMinS === null) errors.paceMin = MSG.paceMin;
  if (paceMaxS === null) errors.paceMax = MSG.paceMax;
  else if (paceMinS !== null && paceMinS >= paceMaxS) errors.paceMax = MSG.paceOrdem;
  if (!Object.hasOwn(NIVEIS, nivel)) errors.nivel = MSG.nivel;
  if (len(descricao) < 30) {
    errors.descricao = `A descrição precisa de pelo menos 30 caracteres (faltam ${30 - len(descricao)}).`;
  } else if (len(descricao) > 400) errors.descricao = maxMsg(400);
  if (len(contato) < 3) errors.contato = MSG.contatoMin;
  else if (len(contato) > 80) errors.contato = maxMsg(80);
  if (!organizador) errors.organizador = MSG.organizador;

  const values = {
    nome,
    zona,
    local,
    ponto,
    dias,
    horario,
    distancia,
    paceMin,
    paceMax,
    nivel,
    participantes,
    descricao,
    contato,
    organizador,
  };
  if (Object.keys(errors).length) return { values, errors, data: null };

  const count = /^\d+$/.test(participantes) ? Number(participantes) : 1;
  const data = {
    name: nome,
    zone: zona,
    location: local,
    meetingPoint: ponto || DEFAULT_PONTO,
    days: dias,
    startTime: horario,
    distance: distancia || null,
    paceMinS,
    paceMaxS,
    level: nivel,
    baseParticipants: count >= 1 && count <= 999 ? count : 1,
    description: descricao,
    contact: contato,
  };
  return { values, errors, data };
}
