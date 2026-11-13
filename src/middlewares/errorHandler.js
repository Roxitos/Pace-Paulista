import { safeNext } from '../domain/redirect.js';
import { locals } from './locals.js';
import { renderNotFound } from './notFound.js';

// Erro do pg: `detail` (ex.: "Key (email)=(a@b.com)") e `message` podem ecoar dados pessoais (LGPD).
function isPgError(err) {
  return typeof err?.code === 'string' && err.code.length === 5;
}

function logError(err) {
  if (isPgError(err)) {
    console.error('Erro do Postgres:', {
      code: err.code,
      constraint: err.constraint,
      table: err.table,
    });
    return;
  }
  console.error(err);
}

// "Atualizar e tentar de novo": volta à página do formulário (Referer do mesmo host) ou à home.
function retryHref(req) {
  try {
    const url = new URL(req.get('referer') ?? '');
    if (url.host !== req.get('host')) return '/';
    return safeNext(url.pathname + url.search, '/');
  } catch {
    return '/';
  }
}

// Erros do Express/body-parser usam `status` ou `statusCode`; qualquer valor fora de 4xx/5xx vira 500.
function statusOf(err) {
  const status = err?.status ?? err?.statusCode;
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

export async function errorHandler(err, req, res, next) {
  // Com a resposta já iniciada não dá para trocar status nem página: o Express encerra a conexão.
  if (res.headersSent) return next(err);

  const status = statusOf(err);
  try {
    // Erro do body-parser acontece antes do middleware `locals`: sem ele não há renderPage.
    if (!res.renderPage) locals(req, res, () => {});
    if (status === 404) {
      await renderNotFound(res);
      return;
    }
    // Só 5xx é falha nossa; logar 4xx deixaria qualquer cliente inundar o log com requisições ruins.
    if (status >= 500) logError(err);
    if (err?.code === 'EBADCSRFTOKEN') {
      res.status(403);
      await res.renderPage('csrf', {
        title: 'Sessão expirada · Pace Paulista',
        retryHref: retryHref(req),
      });
      return;
    }
    res.status(status);
    await res.renderPage('500', { title: 'Erro · Pace Paulista' });
  } catch (renderErr) {
    logError(renderErr);
    if (res.headersSent) return;
    res.status(500).type('text/plain').send('Erro interno.');
  }
}
