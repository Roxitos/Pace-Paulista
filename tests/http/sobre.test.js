import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

async function getSobre() {
  const res = await request(app).get('/sobre');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
  return res.text;
}

describe('GET /sobre (CA7)', () => {
  it('renderiza o cabeçalho e marca "Sobre" no menu', async () => {
    const html = await getSobre();
    expect(html).toContain('<title>Sobre · Pace Paulista</title>');
    expect(html).toContain('<span class="eyebrow">Sobre</span>');
    expect(html).toContain('<h1 class="display">O que é o Pace Paulista</h1>');
    expect(html).toContain(
      '<p>Uma plataforma para conectar corredores de São Paulo aos grupos certos para o seu ritmo e a sua região.</p>',
    );
    expect(html).toContain('href="/sobre" data-nav="sobre" aria-current="page"');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
  });

  it('mostra o painel "A ideia" com os textos do protótipo e o link para os grupos', async () => {
    const html = await getSobre();
    expect(html).toContain(
      '<div class="panel"><h2>A ideia</h2><p>Correr sozinho é ótimo. Correr com gente que tem o seu pace é melhor. Mas os grupos estão espalhados por perfis, conversas e indicações de amigos.</p><p>O Pace Paulista reúne os grupos de corrida das cinco zonas da cidade em um só lugar, com as informações que importam para decidir: onde, quando, em que ritmo e para qual nível.</p>',
    );
    expect(html).toContain(
      '<p style="margin-top:16px"><a class="btn btn-primary" href="/grupos">Explorar grupos <svg class="ico ico-sm"',
    );
  });

  it('lista o status do default de P10: 2 ATIVO e 3 PENDENTE, nesta ordem', async () => {
    const html = await getSobre();
    expect(html).toContain('<h2>Status do protótipo</h2>');
    const status = [
      ...html.matchAll(
        /<li><span class="st (on|off)">(ATIVO|PENDENTE)<\/span><span>([^<]+)<\/span><\/li>/g,
      ),
    ].map((m) => [m[1], m[2], m[3]]);
    expect(status).toEqual([
      [
        'on',
        'ATIVO',
        'Busca com filtros, cards, páginas de detalhes, zonas, cálculo de compatibilidade, cadastro e entrada em grupos.',
      ],
      ['on', 'ATIVO', 'Banco de dados compartilhado para todos verem os mesmos grupos.'],
      ['off', 'PENDENTE', 'Login e conta de usuário.'],
      ['off', 'PENDENTE', 'Mapa interativo com coordenadas reais dos pontos de encontro.'],
      ['off', 'PENDENTE', 'Notificações e confirmação de presença por encontro.'],
    ]);
  });

  it('mantém a nota final e não fala mais de Supabase nem de dados no navegador', async () => {
    const html = await getSobre();
    expect(html).toContain(
      '<p style="color:var(--muted);font-size:14px;margin-top:14px">Todos os grupos de demonstração são fictícios. Os locais citados são espaços públicos reais da cidade.</p>',
    );
    expect(html).not.toContain('Supabase');
    expect(html).not.toContain('navegador');
    expect(html).not.toContain('href="#');
  });
});
