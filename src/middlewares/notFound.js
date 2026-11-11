export async function renderNotFound(res, message) {
  res.status(404);
  await res.renderPage('404', { title: 'Página não encontrada · Pace Paulista', message });
}

export async function notFound(req, res) {
  await renderNotFound(res);
}
