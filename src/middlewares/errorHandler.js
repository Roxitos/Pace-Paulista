import { renderNotFound } from './notFound.js';

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
    if (status === 404) {
      await renderNotFound(res);
      return;
    }
    // Só 5xx é falha nossa; logar 4xx deixaria qualquer cliente inundar o log com requisições ruins.
    if (status >= 500) console.error(err);
    res.status(status);
    await res.renderPage('500', { title: 'Erro · Pace Paulista' });
  } catch (renderErr) {
    console.error(renderErr);
    if (res.headersSent) return;
    res.status(500).type('text/plain').send('Erro interno.');
  }
}
