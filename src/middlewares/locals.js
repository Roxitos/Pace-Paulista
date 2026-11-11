import { env } from '../config/env.js';
import { currentNav } from '../views/helpers.js';

function render(app, view, data) {
  return new Promise((resolve, reject) => {
    app.render(view, data, (err, html) => (err ? reject(err) : resolve(html)));
  });
}

function currentYear(timeZone) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, year: 'numeric' }).format(new Date());
}

export function locals(req, res, next) {
  res.locals.currentPath = req.path;
  res.locals.nav = currentNav(req.path);
  res.locals.year = currentYear(env.TZ_APP);

  res.renderPage = async (view, pageLocals = {}) => {
    const data = { ...res.locals, ...pageLocals };
    const body = await render(req.app, `pages/${view}`, data);
    const html = await render(req.app, 'layout', { ...data, body });
    res.type('html').send(html);
  };

  next();
}
