import 'dotenv/config';
import { z } from 'zod';

const DEV_DATABASE_URL = 'postgres://pace:pace@localhost:5432/pace_paulista';
const DEV_DATABASE_URL_TEST = 'postgres://pace:pace@localhost:5432/pace_paulista_test';
const DEV_SESSION_SECRET = 'dev-inseguro-nao-usar-em-producao';
const EXAMPLE_SESSION_SECRET = 'troque-por-uma-string-longa-e-aleatoria';

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function isValidDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
    url.hostname !== '' &&
    url.pathname.slice(1) !== ''
  );
}

// Na dúvida (caixa diferente no host ou no banco), trata como o mesmo banco: é o lado seguro.
function sameDatabase(a, b) {
  return describeDatabaseUrl(a).toLowerCase() === describeDatabaseUrl(b).toLowerCase();
}

function isStrongSecret(value) {
  return value.length >= 32 && value !== EXAMPLE_SESSION_SECRET && value !== DEV_SESSION_SECRET;
}

// Em produção banco e segredo não têm default: subir com o valor de dev seria pior que não subir.
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    // Fuso inválido só estouraria no Intl a cada requisição; melhor o processo não subir.
    TZ_APP: z.string().min(1).refine(isValidTimeZone).default('America/Sao_Paulo'),
    DATABASE_URL: z.string().optional(),
    DATABASE_URL_TEST: z.string().default(DEV_DATABASE_URL_TEST),
    SESSION_SECRET: z.string().optional(),
  })
  .transform((data, ctx) => {
    const production = data.NODE_ENV === 'production';
    const invalid = (path) => ctx.addIssue({ code: 'custom', path: [path], message: 'inválida' });

    const DATABASE_URL = data.DATABASE_URL ?? (production ? undefined : DEV_DATABASE_URL);
    const SESSION_SECRET = data.SESSION_SECRET ?? (production ? undefined : DEV_SESSION_SECRET);

    if (DATABASE_URL === undefined || !isValidDatabaseUrl(DATABASE_URL)) invalid('DATABASE_URL');
    // Impede que os testes (que fazem TRUNCATE) apaguem o banco de desenvolvimento.
    // Compara o alvo (host:porta/banco), não o texto: outro protocolo ou credencial é o mesmo banco.
    if (
      !isValidDatabaseUrl(data.DATABASE_URL_TEST) ||
      (DATABASE_URL !== undefined &&
        isValidDatabaseUrl(DATABASE_URL) &&
        sameDatabase(data.DATABASE_URL_TEST, DATABASE_URL))
    ) {
      invalid('DATABASE_URL_TEST');
    }
    if (SESSION_SECRET === undefined || (production && !isStrongSecret(SESSION_SECRET))) {
      invalid('SESSION_SECRET');
    }

    return { ...data, DATABASE_URL, SESSION_SECRET };
  });

export function parseEnv(source) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const invalid = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Variáveis de ambiente inválidas: ${invalid.join(', ')}`);
  }
  return result.data;
}

export function connectionStringFor(env) {
  return env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL;
}

// Identifica o banco em logs sem expor usuário e senha.
export function describeDatabaseUrl(url) {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port || '5432'}/${parsed.pathname.slice(1)}`;
}

export const env = parseEnv(process.env);
