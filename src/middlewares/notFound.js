export async function renderNotFound(res) {
  res.status(404);
  await res.renderPage('404', { title: 'Página não encontrada · Pace Paulista' });
}

export async function notFound(req, res) {
  await renderNotFound(res);
}
