import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ZONA_ORDEM } from '../../src/domain/constants.js';
import {
  gmapsBusca,
  gmapsRota,
  hasCoords,
  pinPos,
  ZCENTRO,
  ZLABEL,
  ZPOLY,
} from '../../src/domain/map.js';

const PROTOTIPO = readFileSync(new URL('../../docs/prototipo.html', import.meta.url), 'utf8');

// Reescreve o objeto no formato compacto do protótipo ({norte:[200,40],...}) para achar a linha literal.
function asPrototypeLiteral(obj) {
  return `{${ZONA_ORDEM.map((z) => `${z}:[${obj[z].join(',')}]`).join(',')}}`;
}

describe('geometria do mapa', () => {
  it('ZPOLY é igual ao do protótipo, zona a zona', () => {
    expect(Object.keys(ZPOLY)).toEqual(ZONA_ORDEM);
    for (const z of ZONA_ORDEM) expect(PROTOTIPO).toContain(`${z}:'${ZPOLY[z]}'`);
  });

  it('ZLABEL e ZCENTRO são iguais aos do protótipo', () => {
    expect(PROTOTIPO).toContain(`const ZLABEL = ${asPrototypeLiteral(ZLABEL)};`);
    expect(PROTOTIPO).toContain(`const ZCENTRO = ${asPrototypeLiteral(ZCENTRO)};`);
  });
});

describe('pinPos', () => {
  it('usa map_pin quando existe', () => {
    expect(pinPos({ slug: 'pace-da-oca', zone: 'sul', map_pin: [200, 246] })).toEqual([200, 246]);
  });

  it('sem map_pin calcula pela zona com o hash do protótipo sobre o slug', () => {
    expect(pinPos({ slug: 'abc', zone: 'sul', map_pin: null })).toEqual([177, 305]);
  });

  it.each([[[1]], [null], [undefined], [[1, 2, 3]], [['1', '2']], [[1.5, 2]]])(
    'map_pin inválido (%j) cai no cálculo pela zona',
    (mapPin) => {
      expect(pinPos({ slug: 'abc', zone: 'sul', map_pin: mapPin })).toEqual([177, 305]);
    },
  );

  it.each([[[99999, -5]], [[-1, 100]], [[401, 100]], [[100, 381]]])(
    'map_pin fora do viewBox 400×380 (%j) cai no cálculo pela zona',
    (mapPin) => {
      expect(pinPos({ slug: 'abc', zone: 'sul', map_pin: mapPin })).toEqual([177, 305]);
    },
  );

  it.each([[[0, 0]], [[400, 380]]])('aceita map_pin na borda do viewBox (%j)', (mapPin) => {
    expect(pinPos({ slug: 'abc', zone: 'sul', map_pin: mapPin })).toEqual(mapPin);
  });

  it('fica a no máximo 20 px na horizontal e 15 px na vertical do centro da zona', () => {
    for (const z of ZONA_ORDEM) {
      const [x, y] = pinPos({ slug: `grupo-${z}-teste`, zone: z, map_pin: null });
      const [cx, cy] = ZCENTRO[z];
      expect(Math.abs(x - cx)).toBeLessThanOrEqual(20);
      expect(Math.abs(y - cy)).toBeLessThanOrEqual(15);
    }
  });
});

describe('hasCoords', () => {
  it('só aceita lat e lng numéricos finitos', () => {
    expect(hasCoords({ lat: -23.5, lng: -46.6 })).toBe(true);
    expect(hasCoords({ lat: null, lng: null })).toBe(false);
    expect(hasCoords({ lat: -23.5, lng: null })).toBe(false);
    expect(hasCoords({ lat: Number.NaN, lng: -46.6 })).toBe(false);
    expect(hasCoords({})).toBe(false);
  });
});

describe('links do Google Maps', () => {
  const semPonto = { location: 'Parque Ibirapuera', lat: null, lng: null };
  const comPonto = { location: 'Parque Ibirapuera', lat: -23.5858, lng: -46.6556 };

  it('sem coordenadas, usa o local em São Paulo', () => {
    expect(gmapsRota(semPonto)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Parque%20Ibirapuera%2C%20S%C3%A3o%20Paulo%2C%20SP',
    );
    expect(gmapsBusca(semPonto)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Parque%20Ibirapuera%2C%20S%C3%A3o%20Paulo%2C%20SP',
    );
  });

  it('com coordenadas, usa lat,lng exatos', () => {
    expect(gmapsRota(comPonto)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-23.5858%2C-46.6556',
    );
    expect(gmapsBusca(comPonto)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-23.5858%2C-46.6556',
    );
  });

  it('codifica & e # do local para não quebrar a query', () => {
    const g = { location: 'Praça A & B #2' };
    expect(gmapsRota(g)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Pra%C3%A7a%20A%20%26%20B%20%232%2C%20S%C3%A3o%20Paulo%2C%20SP',
    );
    expect(gmapsBusca(g)).toContain('query=Pra%C3%A7a%20A%20%26%20B%20%232%2C');
  });
});
