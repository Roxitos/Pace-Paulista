import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { createTestApp, getCsrf } from '../helpers/auth.js';
import { migrateTestDb, seedDemo } from '../helpers/db.js';

const app = createApp();
const testApp = createTestApp();

// GET / lê os grupos do banco desde a spec 004.
beforeAll(async () => {
  await migrateTestDb(pool);
  await seedDemo(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('GET /', () => {
  it('renderiza o layout com header e footer do protótipo', async () => {
    const res = await request(app).get('/');
    const year = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
    }).format(new Date());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<title>Pace Paulista</title>');
    expect(res.text).toContain('class="hdr"');
    expect(res.text).toContain('PACE <b>PAULISTA</b>');
    expect(res.text).toContain('href="/css/app.css"');
    expect(res.text).toContain('class="ftr"');
    expect(res.text).toContain('Encontre seu grupo.');
    expect(res.text).toContain(`<span id="yr">${year}</span>`);
    expect(res.text).toContain(
      'Os grupos marcados como “Fictício · demo” servem apenas para demonstrar a plataforma.',
    );
    expect(res.text).not.toContain('Nenhum dado é enviado a servidores');
  });

  it('marca só o link Início com aria-current', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('data-nav="inicio" aria-current="page"');
    expect(res.text.match(/aria-current=/g)).toHaveLength(1);
  });

  it('não tem links de hash do protótipo nem script inline', async () => {
    const res = await request(app).get('/');
    expect(res.text).not.toContain('href="#');
    expect(res.text).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(res.text).toContain('<script src="/js/app.js" defer></script>');
  });

  it('não expõe o header x-powered-by', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('arquivos estáticos', () => {
  it('serve o CSS do protótipo', async () => {
    const res = await request(app).get('/css/app.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
    expect(res.text).toContain('--pista:#B3262E');
  });

  it('mantém o bloco principal do CSS igual ao <style> das linhas 7–354 do protótipo', () => {
    const proto = readFileSync(new URL('../../docs/prototipo.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../../public/css/app.css', import.meta.url), 'utf8');
    const original = proto.split('\n').slice(6, 354).join('\n');
    const marker = '/* Layout: cabeçalho fixo';
    expect(css.slice(css.indexOf(marker)).trimEnd()).toBe(original.trimEnd());
  });

  it('serve o JS do cliente', async () => {
    const res = await request(app).get('/js/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });
});

describe('404', () => {
  it('renderiza a página não encontrada dentro do layout', async () => {
    const res = await request(app).get('/nao-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<title>Página não encontrada · Pace Paulista</title>');
    expect(res.text).toContain('Página não encontrada');
    expect(res.text).toContain('Esse endereço não existe.');
    expect(res.text).toContain('<a class="btn btn-primary" href="/">Voltar ao início</a>');
    expect(res.text).toContain('class="hdr"');
    expect(res.text).toContain('class="ftr"');
    expect(res.text).not.toContain('aria-current=');
  });

  it('responde 404 também para POST em rota inexistente', async () => {
    // Com token válido, para chegar ao 404 (o CSRF roda antes das rotas).
    const agent = request.agent(testApp);
    const _csrf = await getCsrf(agent);
    const res = await agent.post('/nao-existe').type('form').send({ _csrf });
    expect(res.status).toBe(404);
    expect(res.text).toContain('Página não encontrada');
  });

  it('trata erro com status 404 como página não encontrada, sem a mensagem do erro', async () => {
    const appComErro = createApp({
      beforeErrorHandlers(a) {
        a.get('/__teste/404', () => {
          throw Object.assign(new Error('segredo-404'), { status: 404 });
        });
      },
    });
    const res = await request(appComErro).get('/__teste/404');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Esse endereço não existe.');
    expect(res.text).not.toContain('segredo-404');
  });
});

describe('500', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const appComErro = createApp({
    beforeErrorHandlers(a) {
      a.get('/__teste/sync', () => {
        throw new Error('segredo-sync');
      });
      a.get('/__teste/async', async () => {
        throw new Error('segredo-async');
      });
    },
  });

  it.each([
    ['/__teste/sync', 'segredo-sync'],
    ['/__teste/async', 'segredo-async'],
  ])('%s responde a página 500 sem vazar o erro', async (path, secret) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(appComErro).get(path);
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<title>Erro · Pace Paulista</title>');
    expect(res.text).toContain('Algo deu errado');
    expect(res.text).toContain(
      'Tivemos um problema ao carregar esta página. Tente de novo em instantes.',
    );
    expect(res.text).toContain('href="/">Voltar ao início</a>');
    expect(res.text).toContain('class="hdr"');
    expect(res.text).not.toContain(secret);
    expect(res.text).not.toMatch(/at .*\.js:\d+/);
  });

  it('responde texto puro quando a própria página de erro falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const appQuebrado = createApp({
      beforeErrorHandlers(a) {
        a.get('/__teste/quebrado', (req, res) => {
          res.renderPage = async () => {
            throw new Error('falha-render');
          };
          throw new Error('segredo-original');
        });
      },
    });
    const res = await request(appQuebrado).get('/__teste/quebrado');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('Erro interno.');
  });

  it('a rota de erro de teste não existe no app real', async () => {
    const res = await request(app).get('/__teste/sync');
    expect(res.status).toBe(404);
  });
});

describe('erros de cliente (4xx)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const appComErro = createApp({
    beforeErrorHandlers(a) {
      a.get('/__teste/400', () => {
        throw Object.assign(new Error('segredo-400'), { status: 400, expose: true });
      });
      a.get('/__teste/413', () => {
        throw Object.assign(new Error('segredo-413'), { statusCode: 413, expose: true });
      });
      a.get('/__teste/404-statuscode', () => {
        throw Object.assign(new Error('segredo-404'), { statusCode: 404 });
      });
      a.get('/__teste/status-invalido', () => {
        throw Object.assign(new Error('segredo-999'), { status: 999 });
      });
    },
  });

  it.each([
    ['/__teste/400', 400, 'segredo-400'],
    ['/__teste/413', 413, 'segredo-413'],
  ])(
    '%s preserva o status %i com a página de erro, sem vazar a mensagem',
    async (path, status, secret) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(appComErro).get(path);
      expect(res.status).toBe(status);
      expect(res.text).toContain('Algo deu errado');
      expect(res.text).toContain('class="hdr"');
      expect(res.text).not.toContain(secret);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('trata statusCode 404 como página não encontrada', async () => {
    const res = await request(appComErro).get('/__teste/404-statuscode');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Esse endereço não existe.');
    expect(res.text).not.toContain('segredo-404');
  });

  it('status fora de 4xx/5xx vira 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(appComErro).get('/__teste/status-invalido');
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('segredo-999');
  });
});

describe('erro depois de a resposta ter começado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encerra a conexão em vez de deixar a requisição pendurada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const appComErro = createApp({
      beforeErrorHandlers(a) {
        a.get('/__teste/parcial', (req, res) => {
          res.write('parcial');
          throw new Error('segredo-parcial');
        });
      },
    });
    const outcome = await request(appComErro)
      .get('/__teste/parcial')
      .timeout(2000)
      .then(
        () => 'terminou',
        (err) => (err.timeout ? 'pendurou' : 'terminou'),
      );
    expect(outcome).toBe('terminou');
  });
});
