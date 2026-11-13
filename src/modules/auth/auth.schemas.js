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
