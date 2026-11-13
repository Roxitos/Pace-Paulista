import { z } from 'zod';
import { safeNext } from '../../domain/redirect.js';

const MSG = {
  nameTooShort: 'Informe um nome com pelo menos 2 caracteres.',
  nameTooLong: 'Use no máximo 40 caracteres.',
  email: 'Informe um e-mail válido.',
  passwordLength: 'A senha precisa ter de 8 a 72 caracteres.',
  passwordSpecial: 'A senha precisa de pelo menos 1 caractere especial (ex.: ! @ # $ %).',
};

// Sem caracteres de controle: NUL derrubaria o INSERT (22021) e nenhum e-mail real os tem.
const EMAIL_RE = /^[^\s@\p{Cc}]+@[^\s@\p{Cc}]+\.[^\s@\p{Cc}]+$/u;
const ESPECIAL_RE = /[^\p{L}\p{N}]/u;

function text(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : '';
}

// Roda sobre os valores já normalizados (trim/NFC). Tamanhos em code points, como o char_length do banco.
const signupSchema = z.object({
  nome: z
    .string()
    .refine((s) => [...s].length >= 2, { error: MSG.nameTooShort, abort: true })
    .refine((s) => [...s].length <= 40, { error: MSG.nameTooLong }),
  email: z.string().refine((s) => s.length <= 254 && EMAIL_RE.test(s), { error: MSG.email }),
  senha: z
    .string()
    // O bcrypt só usa os 72 primeiros bytes: acima disso senhas diferentes colidiriam.
    .refine(
      (s) => [...s].length >= 8 && [...s].length <= 72 && Buffer.byteLength(s, 'utf8') <= 72,
      {
        error: MSG.passwordLength,
        abort: true,
      },
    )
    .refine((s) => ESPECIAL_RE.test(s), { error: MSG.passwordSpecial }),
});

// Ordem de inserção dos erros = ordem dos campos no form (o 1º recebe o foco).
const ERROR_ORDER = ['nome', 'email', 'senha'];

/**
 * Normaliza o body do POST /conta/criar e valida. Nunca lança.
 * `values` reexibe o form (sem a senha); `errors` na ordem nome, email, senha;
 * `data` só existe quando não há erro.
 */
export function parseSignup(body) {
  const src = body !== null && typeof body === 'object' ? body : {};
  // O Postgres recusa texto com NUL (22021): sem isso, nome=%00 virava 500 (mesmo tratamento de filters.js).
  const nome = text(src.nome).replaceAll('\0', '').trim().normalize('NFC');
  const email = text(src.email).trim().normalize('NFC');
  const senha = text(src.senha);
  const next = safeNext(text(src.next), '');

  const result = signupSchema.safeParse({ nome, email, senha });
  const errors = {};
  if (!result.success) {
    for (const key of ERROR_ORDER) {
      const issue = result.error.issues.find((i) => i.path[0] === key);
      if (issue) errors[key] = issue.message;
    }
  }

  const data = result.success ? { displayName: nome, email, password: senha } : null;
  return { values: { nome, email, next }, errors, data };
}

const LOGIN_MSG = { email: 'Informe seu e-mail.', senha: 'Informe sua senha.' };

/**
 * Normaliza o body do POST /conta/entrar. Login só exige campos preenchidos:
 * regras de formato/tamanho ficam no cadastro, para não trancar contas antigas. Nunca lança.
 * `values` não contém a senha; `data` só existe quando não há erro.
 */
export function parseLogin(body) {
  const src = body !== null && typeof body === 'object' ? body : {};
  // NUL derrubaria a query (22021), como no cadastro.
  const email = text(src.email).replaceAll('\0', '').trim().normalize('NFC');
  const senha = text(src.senha);
  const next = safeNext(text(src.next), '');

  const errors = {};
  if (!email) errors.email = LOGIN_MSG.email;
  if (!senha) errors.senha = LOGIN_MSG.senha;

  const data = Object.keys(errors).length ? null : { email, password: senha };
  return { values: { email, next }, errors, data };
}

/**
 * Parte "e-mail" da chave do rate limit do login. Precisa juntar tudo que o citext do banco
 * considera igual: 'İ'.toLowerCase() no JS vira i + U+0307, mas no banco casa com 'i', e cada
 * variante abriria uma cota nova contra a mesma conta. Tirar acentos junta e-mails distintos
 * no mesmo balde (só deixa o limite mais rígido). Corte em 254: nenhum e-mail real passa disso
 * e o corpo inteiro não vira chave na memória do limiter.
 */
export function loginLimitKey(email) {
  return email.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').slice(0, 254);
}
