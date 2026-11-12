import { describe, expect, it } from 'vitest';
import { DEMO_GROUPS } from '../../db/seeds/demo-groups.js';
import { rankMatches } from '../../src/domain/match.js';

// Critério de pronto do M4 (spec 008): as mesmas respostas dão a mesma lista, ordem, porcentagens
// e motivos que o protótipo. O bloco abaixo é cópia literal de docs/prototipo.html; não editar.
// (Das constantes, só os campos que calcMatch lê; ZONAS e NIVEIS completos estão em constants.test.)

/* ---- início da cópia literal do protótipo ---- */
// prettier-ignore
const ZONAS = {norte:{nome:'Zona Norte'},oeste:{nome:'Zona Oeste'},centro:{nome:'Centro'},leste:{nome:'Zona Leste'},sul:{nome:'Zona Sul'}};
// prettier-ignore
const DIAS = {dom:'Domingo',seg:'Segunda',ter:'Terça',qua:'Quarta',qui:'Quinta',sex:'Sexta',sab:'Sábado'};
// prettier-ignore
const DIA_ORDEM = ['seg','ter','qua','qui','sex','sab','dom'];
// prettier-ignore
const NIVEIS = {iniciante:{nome:'Iniciante',n:1},intermediario:{nome:'Intermediário',n:2},avancado:{nome:'Avançado',n:3}};
// prettier-ignore
const sortDias = d => [...d].sort((a,b)=>DIA_ORDEM.indexOf(a)-DIA_ORDEM.indexOf(b));
// prettier-ignore
const listaPt = arr => arr.length<2?arr.join(''):arr.slice(0,-1).join(', ')+' e '+arr[arr.length-1];
// prettier-ignore
const periodoDe = h => { const x=+h.split(':')[0]; return x<7?'cedo':x<12?'manha':x<18?'tarde':'noite'; };
// prettier-ignore
function calcMatch(g,q){
  let s=0,max=0; const why=[];
  max+=30; if(q.zona==='qualquer'||q.zona===g.zona){s+=30; if(q.zona!=='qualquer') why.push(`Fica na ${ZONAS[g.zona].nome}`);}
  max+=35; if(q.pace>=g.paceMin&&q.pace<=g.paceMax){s+=35;why.push('Seu pace está na faixa do grupo');}
  else{const d=Math.min(Math.abs(q.pace-g.paceMin),Math.abs(q.pace-g.paceMax)); if(d<=30){s+=20;why.push('Seu pace está a até 30 s/km da faixa');} else if(d<=60){s+=8;}}
  max+=20; const comuns=g.dias.filter(d=>q.dias.includes(d)); if(comuns.length){s+=20;why.push('Treina '+listaPt(sortDias(comuns).map(d=>DIAS[d].toLowerCase())));}
  max+=15; const dn=Math.abs(NIVEIS[g.nivel].n-NIVEIS[q.nivel].n); if(!dn){s+=15;why.push('Mesmo nível que você');} else if(dn===1) s+=6;
  if(q.periodo){max+=10; if(periodoDe(g.horario)===q.periodo){s+=10;why.push('No horário que você prefere');}}
  return {pct:Math.round(s/max*100),why};
}
// prettier-ignore
const prototipo = (api, q) => api.listGroups().map(g=>({g,...calcMatch(g,q)})).filter(r=>r.pct>=40).sort((a,b)=>b.pct-a.pct).slice(0,6);
/* ---- fim da cópia literal ---- */

// DEMO_GROUPS no formato do protótipo, na ordem do DEMO (id = slug).
const PROTO_GROUPS = DEMO_GROUPS.map((g) => ({
  id: g.slug,
  zona: g.zone,
  paceMin: g.pace_min_s,
  paceMax: g.pace_max_s,
  dias: g.days,
  nivel: g.level,
  horario: g.start_time,
}));
const api = { listGroups: () => PROTO_GROUPS };

const ZONAS_Q = ['norte', 'oeste', 'centro', 'leste', 'sul', 'qualquer'];
const NIVEIS_Q = ['iniciante', 'intermediario', 'avancado'];
const PERIODOS_Q = ['', 'cedo', 'manha', 'tarde', 'noite'];

function subsets(items) {
  const out = [];
  for (let mask = 1; mask < 1 << items.length; mask++) {
    out.push(items.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

function paces() {
  const set = new Set();
  for (let s = 180; s <= 720; s += 15) set.add(s);
  for (const g of DEMO_GROUPS) {
    for (const edge of [g.pace_min_s, g.pace_max_s]) {
      for (const d of [0, 1, 30, 31, 60, 61]) {
        for (const s of [edge - d, edge + d]) if (s >= 180 && s <= 720) set.add(s);
      }
    }
  }
  return [...set].sort((a, b) => a - b);
}

const key = (rows) => rows.map((r) => `${r.slug}:${r.pct}:${r.why.join('|')}`).join('\n');
const fromSite = (q) =>
  key(rankMatches(DEMO_GROUPS, q).map((r) => ({ slug: r.group.slug, pct: r.pct, why: r.why })));
const fromProto = (q) =>
  key(prototipo(api, q).map((r) => ({ slug: r.g.id, pct: r.pct, why: r.why })));

describe('rankMatches × cópia literal do protótipo', () => {
  // A grade com os 127 subconjuntos de dias levava ~10 s; a spec manda reduzir aos de
  // tamanho 1, 2 e 7 (todas as bordas de pace continuam).
  it('dá a mesma lista, ordem, pct e motivos em toda a grade', () => {
    const diasGrid = subsets(DIA_ORDEM).filter((d) => [1, 2, 7].includes(d.length));
    const paceGrid = paces();
    let count = 0;
    const diffs = [];
    for (const zona of ZONAS_Q) {
      for (const dias of diasGrid) {
        for (const nivel of NIVEIS_Q) {
          for (const periodo of PERIODOS_Q) {
            for (const pace of paceGrid) {
              const q = { zona, pace, dias, nivel, periodo };
              count++;
              if (fromSite(q) !== fromProto(q) && diffs.length < 5) diffs.push(q);
            }
          }
        }
      }
    }
    expect(diffs).toEqual([]);
    expect(count).toBe(6 * (7 + 21 + 1) * 3 * 5 * paceGrid.length);
  });
});

const ZONA = (z) => `Fica na ${z}`;
const NA_FAIXA = 'Seu pace está na faixa do grupo';
const PERTO = 'Seu pace está a até 30 s/km da faixa';
const NIVEL = 'Mesmo nível que você';
const HORARIO = 'No horário que você prefere';

// Bateria da spec 008 (calculada com a cópia literal do protótipo). why ausente = só slug e pct.
const CASOS = [
  [
    'A',
    { zona: 'sul', pace: 300, dias: ['seg', 'qua'], nivel: 'avancado', periodo: '' },
    [
      ['pace-da-oca', 100, [ZONA('Zona Sul'), NA_FAIXA, 'Treina segunda e quarta', NIVEL]],
      ['minhocao-noturno', 61, [NA_FAIXA, 'Treina quarta']],
      ['represa-run-club', 56, [ZONA('Zona Sul'), PERTO]],
      ['pelotao-paulista', 41, [NA_FAIXA]],
      ['villa-lobos-runners', 41, [NA_FAIXA]],
    ],
  ],
  [
    'B',
    { zona: 'qualquer', pace: 360, dias: ['ter', 'qui'], nivel: 'iniciante', periodo: 'noite' },
    [
      ['tiete-em-movimento', 100, [NA_FAIXA, 'Treina terça e quinta', NIVEL, HORARIO]],
      ['juventude-em-pace', 100, [NA_FAIXA, 'Treina terça e quinta', NIVEL, HORARIO]],
      ['villa-lobos-runners', 83, [NA_FAIXA, 'Treina terça e quinta']],
      ['minhocao-noturno', 74, [NA_FAIXA, HORARIO]],
      ['correria-do-carmo', 65, [NA_FAIXA]],
      ['represa-run-club', 65, [NA_FAIXA]],
    ],
  ],
  [
    'C',
    { zona: 'leste', pace: 360, dias: ['sab', 'dom'], nivel: 'intermediario', periodo: '' },
    [
      ['correria-do-carmo', 100, [ZONA('Zona Leste'), NA_FAIXA, 'Treina sábado', NIVEL]],
      ['tiete-em-movimento', 71],
      ['represa-run-club', 70],
      ['pelotao-paulista', 55],
      ['cantareira-trail', 55],
      ['minhocao-noturno', 50],
    ],
  ],
  ['D', { zona: 'norte', pace: 180, dias: ['seg'], nivel: 'avancado', periodo: '' }, []],
  [
    'E',
    { zona: 'qualquer', pace: 330, dias: ['dom'], nivel: 'intermediario', periodo: 'manha' },
    [
      ['pelotao-paulista', 100],
      ['represa-run-club', 100],
      ['cantareira-trail', 75],
      ['correria-do-carmo', 73],
      ['minhocao-noturno', 73],
      ['villa-lobos-runners', 73],
    ],
  ],
  [
    'F',
    { zona: 'centro', pace: 315, dias: ['qua', 'dom'], nivel: 'intermediario', periodo: '' },
    [
      ['pelotao-paulista', 100, [ZONA('Centro'), NA_FAIXA, 'Treina domingo', NIVEL]],
      ['minhocao-noturno', 100, [ZONA('Centro'), NA_FAIXA, 'Treina quarta', NIVEL]],
      ['represa-run-club', 55],
      ['villa-lobos-runners', 50],
      ['pace-da-oca', 46],
    ],
  ],
  [
    'G',
    {
      zona: 'qualquer',
      pace: 360,
      dias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
      nivel: 'intermediario',
      periodo: '',
    },
    [
      ['correria-do-carmo', 100],
      ['minhocao-noturno', 100],
      ['represa-run-club', 100],
      ['villa-lobos-runners', 100],
      ['tiete-em-movimento', 91],
      ['juventude-em-pace', 91],
    ],
  ],
  [
    'H',
    { zona: 'oeste', pace: 270, dias: ['sab'], nivel: 'avancado', periodo: 'cedo' },
    [
      ['raia-usp', 91, [ZONA('Zona Oeste'), NA_FAIXA, 'Treina sábado', NIVEL]],
      ['villa-lobos-runners', 60, [ZONA('Zona Oeste'), PERTO, HORARIO]],
      ['pace-da-oca', 55, [NA_FAIXA, NIVEL, HORARIO]],
      ['correria-do-carmo', 40, ['Treina sábado', HORARIO]],
    ],
  ],
  [
    'I',
    { zona: 'leste', pace: 390, dias: ['ter'], nivel: 'iniciante', periodo: '' },
    [
      ['tiete-em-movimento', 100],
      ['correria-do-carmo', 71],
      ['juventude-em-pace', 70],
      ['villa-lobos-runners', 46],
      ['represa-run-club', 41],
      ['cantareira-trail', 41],
    ],
  ],
  [
    'J',
    { zona: 'norte', pace: 180, dias: ['ter'], nivel: 'iniciante', periodo: '' },
    [['juventude-em-pace', 65, [ZONA('Zona Norte'), 'Treina terça', NIVEL]]],
  ],
];

describe('bateria de equivalência da spec 008 (11 grupos demo)', () => {
  it.each(CASOS)('caso %s', (_nome, q, esperado) => {
    const got = rankMatches(DEMO_GROUPS, q);
    expect(got.map((r) => [r.group.slug, r.pct])).toEqual(esperado.map(([s, p]) => [s, p]));
    esperado.forEach(([, , why], i) => {
      if (why) expect(got[i].why).toEqual(why);
    });
    expect(fromSite(q)).toBe(fromProto(q));
  });
});
