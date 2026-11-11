import 'dotenv/config';
import { z } from 'zod';

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // Fuso inválido só estouraria no Intl a cada requisição; melhor o processo não subir.
  TZ_APP: z.string().min(1).refine(isValidTimeZone).default('America/Sao_Paulo'),
});

export function parseEnv(source) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const invalid = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Variáveis de ambiente inválidas: ${invalid.join(', ')}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
