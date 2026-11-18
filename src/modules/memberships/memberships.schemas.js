import { z } from 'zod';

const MSG = {
  nicknameShort: 'Use pelo menos 2 letras ou deixe em branco.',
  nicknameLong: 'Use no máximo 40 caracteres.',
  ok: 'Confirme que leu as orientações.',
};

function text(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : '';
}

// Tamanhos em code points, como o char_length do banco.
const joinSchema = z.object({
  apelido: z
    .string()
    // Vazio = usar o nome completo da conta.
    .refine((s) => s === '' || [...s].length >= 2, { error: MSG.nicknameShort, abort: true })
    .refine((s) => [...s].length <= 40, { error: MSG.nicknameLong }),
  ok: z.boolean().refine(Boolean, { error: MSG.ok }),
});

const ERROR_ORDER = ['apelido', 'ok'];

/**
 * Normaliza o body do POST /grupos/:slug/participar e valida. Nunca lança.
 * `values.apelido` já vem trimado; `errors` na ordem apelido, ok; `data` só sem erros.
 */
export function parseJoinForm(body) {
  const src = body !== null && typeof body === 'object' ? body : {};
  // NUL derrubaria o INSERT (22021).
  const apelido = text(src.apelido).replaceAll('\0', '').trim().normalize('NFC');
  const ok = text(src.ok) !== '';

  const result = joinSchema.safeParse({ apelido, ok });
  const errors = {};
  if (!result.success) {
    for (const key of ERROR_ORDER) {
      const issue = result.error.issues.find((i) => i.path[0] === key);
      if (issue) errors[key] = issue.message;
    }
  }
  return {
    values: { apelido, ok },
    errors,
    data: result.success ? { nickname: apelido || null } : null,
  };
}
