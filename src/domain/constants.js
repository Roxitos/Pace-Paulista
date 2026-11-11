// Copiado literalmente de docs/prototipo.html (seção "1. constants").
export const ZONAS = {
  norte: {
    nome: 'Zona Norte',
    curto: 'Norte',
    cor: '#5E9A22',
    on: '#FFFFFF',
    marco: 'Serra da Cantareira',
    desc: 'Trilhas, subidas e muito verde no pé da Cantareira. Treinos com altimetria para quem gosta de terreno variado.',
  },
  oeste: {
    nome: 'Zona Oeste',
    curto: 'Oeste',
    cor: '#7A3FA0',
    on: '#FFFFFF',
    marco: 'Ponte Estaiada',
    desc: 'Parques planos e retas longas às margens do Pinheiros. Boa para treinos de ritmo e longões.',
  },
  centro: {
    nome: 'Centro',
    curto: 'Centro',
    cor: '#E8892B',
    on: '#17171A',
    marco: 'Avenida Paulista',
    desc: 'Asfalto, prédios e avenidas abertas para pedestres. Corridas urbanas no coração da cidade.',
  },
  leste: {
    nome: 'Zona Leste',
    curto: 'Leste',
    cor: '#C8402F',
    on: '#FFFFFF',
    marco: 'Arena Corinthians',
    desc: 'Parques enormes e comunidades de bairro muito unidas. Do Carmo ao Tietê, tem pace para todo mundo.',
  },
  sul: {
    nome: 'Zona Sul',
    curto: 'Sul',
    cor: '#3A78C2',
    on: '#FFFFFF',
    marco: 'Oca do Ibirapuera',
    desc: 'O Ibirapuera é o ponto mais movimentado da corrida paulistana, com grupos de todos os níveis e a represa mais ao sul.',
  },
};

export const ZONA_ORDEM = ['norte', 'oeste', 'centro', 'leste', 'sul'];

export const DIAS = {
  dom: 'Domingo',
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
};

export const DIAS_CURTO = {
  dom: 'Dom',
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
};

export const DIA_ORDEM = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export const NIVEIS = {
  iniciante: { nome: 'Iniciante', n: 1 },
  intermediario: { nome: 'Intermediário', n: 2 },
  avancado: { nome: 'Avançado', n: 3 },
};

export const DESTAQUES = ['correria-do-carmo', 'pace-da-oca', 'pelotao-paulista'];
