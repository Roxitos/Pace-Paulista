import request from 'supertest';
import { createApp } from '../../src/app.js';

// Rotas só de teste: o app real não as registra (beforeErrorHandlers nunca é usado pelo server.js).
export function createTestApp() {
  return createApp({
    beforeErrorHandlers(app) {
      app.get('/__test/login/:id', (req, res, next) => {
        req.session.regenerate((err) => {
          if (err) return next(err);
          req.session.userId = req.params.id;
          res.type('text').send('ok');
        });
      });
      app.get('/__test/form', (req, res, next) => {
        req.app.render('partials/csrf', res.locals, (err, input) => {
          if (err) return next(err);
          res.type('html').send(`<form method="post" action="/__test/eco">${input}</form>`);
        });
      });
      app.post('/__test/eco', (req, res) => {
        res.type('text').send('eco');
      });
    },
  });
}

export async function getCsrf(agent, path = '/__test/form') {
  const res = await agent.get(path);
  const match = /name="_csrf" value="([^"]+)"/.exec(res.text);
  if (!match) throw new Error(`Sem _csrf em ${path}`);
  return match[1];
}

// Cria a conta pelo formulário e devolve o agente já logado.
export async function signedUp(app, nome, email) {
  const agent = request.agent(app);
  const csrf = await getCsrf(agent, '/conta/criar');
  await agent
    .post('/conta/criar')
    .type('form')
    .send({ _csrf: csrf, nome, email, senha: 'abcdefg!' })
    .expect(303);
  return agent;
}
