import { safeNext } from '../../domain/redirect.js';

const MSG = {
  nomeCurto: 'Informe um nome com pelo menos 2 caracteres.',
  nomeLongo: 'Use no máximo 40 caracteres.',
  email: 'Informe um e-mail válido.',
  senhaTamanho: 'A senha precisa ter de 8 a 72 caracteres.',
  senhaEspecial: 'A senha precisa de pelo menos 1 caractere especial (ex.: ! @ # $ %).',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESPECIAL_RE = /[^\p{L}\p{N}]/u;

function text(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : '';
}

function validateNome(nome) {
  // Code points, como o char_length do CHECK do banco.
  const len = [...nome].length;
  if (len < 2) return MSG.nomeCurto;
  if (len > 40) return MSG.nomeLongo;
  return null;
}

function validateEmail(email) {
  return email.length <= 254 && EMAIL_RE.test(email) ? null : MSG.email;
}

function validateSenha(senha) {
  // O bcrypt só usa os 72 primeiros bytes: acima disso senhas diferentes colidiriam.
  const len = [...senha].length;
  if (len < 8 || len > 72 || Buffer.byteLength(senha, 'utf8') > 72) return MSG.senhaTamanho;
  return ESPECIAL_RE.test(senha) ? null : MSG.senhaEspecial;
}

/**
 * Normaliza o body do POST /conta/criar e valida. Nunca lança.
 * `values` reexibe o form (sem a senha); `errors` na ordem nome, email, senha;
 * `data` só existe quando não há erro.
 */
export function parseSignup(body) {
  const src = body !== null && typeof body === 'object' ? body : {};
  const nome = text(src.nome).trim().normalize('NFC');
  const email = text(src.email).trim().normalize('NFC');
  const senha = text(src.senha);
  const next = safeNext(text(src.next), '');

  const errors = {};
  const checks = [
    ['nome', validateNome(nome)],
    ['email', validateEmail(email)],
    ['senha', validateSenha(senha)],
  ];
  for (const [key, msg] of checks) if (msg) errors[key] = msg;

  const data = Object.keys(errors).length ? null : { displayName: nome, email, password: senha };
  return { values: { nome, email, next }, errors, data };
}
