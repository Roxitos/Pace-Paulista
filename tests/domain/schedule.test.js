import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fmtDiasCurto,
  fmtDiasLongo,
  fmtEncontro,
  fmtHora,
  periodoDe,
  proximos,
  sortDias,
} from '../../src/domain/schedule.js';

describe('fmtHora', () => {
  it.each([
    ['06:30', '6h30'],
    ['07:00', '7h'],
    ['19:30', '19h30'],
  ])('formata "%s" como "%s"', (hhmm, expected) => {
    expect(fmtHora(hhmm)).toBe(expected);
  });
});

describe('fmtDiasCurto', () => {
  it('ordena de segunda a domingo e abrevia', () => {
    expect(fmtDiasCurto(['sex', 'seg', 'qua'])).toBe('Seg, Qua, Sex');
  });

  it('coloca domingo depois de sábado', () => {
    expect(fmtDiasCurto(['dom', 'sab'])).toBe('Sáb, Dom');
  });
});

describe('sortDias', () => {
  it('não muta a lista recebida', () => {
    const days = ['dom', 'seg'];
    expect(sortDias(days)).toEqual(['seg', 'dom']);
    expect(days).toEqual(['dom', 'seg']);
  });
});

describe('fmtHora com valor inválido', () => {
  it('aceita o formato TIME do pg com segundos', () => {
    expect(fmtHora('06:30:00')).toBe('6h30');
    expect(fmtHora('00:00')).toBe('0h');
  });

  it.each(['abc', '', '6:30', '24:00', '06:60', '06:30:99', 'x06:30', null, undefined, 630])(
    'lança erro para %s',
    (v) => {
      expect(() => fmtHora(v)).toThrow();
    },
  );
});

describe('dias inválidos', () => {
  it.each([['xxx'], ['toString'], ['Seg'], [undefined]])('sortDias lança erro para %s', (d) => {
    expect(() => sortDias(['seg', d])).toThrow();
  });

  it('fmtDiasCurto lança erro em vez de renderizar dia vazio', () => {
    expect(() => fmtDiasCurto(['xxx', 'seg'])).toThrow();
    expect(() => fmtDiasCurto(['toString'])).toThrow();
  });
});

describe('periodoDe', () => {
  it.each([
    ['00:00', 'cedo'],
    ['06:30:00', 'cedo'],
    ['06:59', 'cedo'],
    ['07:00', 'manha'],
    ['11:59', 'manha'],
    ['12:00', 'tarde'],
    ['17:59', 'tarde'],
    ['18:00', 'noite'],
    ['23:59', 'noite'],
  ])('classifica "%s" como %s', (hhmm, expected) => {
    expect(periodoDe(hhmm)).toBe(expected);
  });

  it.each(['abc', '', '6:30', '24:00', '06:60', null, undefined, 630])(
    'lança RangeError para %s',
    (v) => {
      expect(() => periodoDe(v)).toThrow(RangeError);
    },
  );
});

describe('fmtDiasLongo', () => {
  it.each([
    [['sex', 'seg', 'qua'], 'Segunda, Quarta e Sexta'],
    [['qui', 'ter'], 'Terça e Quinta'],
    [['sab'], 'Sábado'],
    [['dom', 'sab'], 'Sábado e Domingo'],
  ])('formata %j como "%s"', (days, expected) => {
    expect(fmtDiasLongo(days)).toBe(expected);
  });

  it('não muta a lista recebida', () => {
    const days = ['sex', 'seg', 'qua'];
    fmtDiasLongo(days);
    expect(days).toEqual(['sex', 'seg', 'qua']);
  });

  it('lança erro para dia inválido', () => {
    expect(() => fmtDiasLongo(['seg', 'xxx'])).toThrow(RangeError);
  });
});

const iso = (dates) => dates.map((d) => d.toISOString());
const SABADO_630 = { days: ['sab'], start_time: '06:30' };

describe('proximos (fuso de SP)', () => {
  it('sábado 6h00 em SP: inclui o treino de hoje às 6h30 e devolve 4 datas', () => {
    expect(iso(proximos(SABADO_630, new Date('2026-11-14T09:00:00Z')))).toEqual([
      '2026-11-14T09:30:00.000Z',
      '2026-11-21T09:30:00.000Z',
      '2026-11-28T09:30:00.000Z',
      '2026-12-05T09:30:00.000Z',
    ]);
  });

  it('treino de hoje já passou: a janela de 28 dias só alcança 3 datas', () => {
    expect(iso(proximos(SABADO_630, new Date('2026-11-14T09:31:00Z')))).toEqual([
      '2026-11-21T09:30:00.000Z',
      '2026-11-28T09:30:00.000Z',
      '2026-12-05T09:30:00.000Z',
    ]);
  });

  it('exatamente no horário do treino ele já não conta (precisa ser depois de agora)', () => {
    const out = proximos(SABADO_630, new Date('2026-11-14T09:30:00Z'));
    expect(out[0].toISOString()).toBe('2026-11-21T09:30:00.000Z');
  });

  it('usa a data de SP mesmo quando em UTC já é domingo', () => {
    const out = proximos(
      { days: ['sab'], start_time: '23:00' },
      new Date('2026-11-15T01:00:00Z'), // sábado 22h em SP
    );
    expect(out[0].toISOString()).toBe('2026-11-15T02:00:00.000Z');
  });

  it('vários dias por semana, a partir de uma quinta', () => {
    const out = proximos(
      { days: ['seg', 'qua', 'sex'], start_time: '06:00' },
      new Date('2026-11-12T12:00:00Z'),
    );
    expect(iso(out)).toEqual([
      '2026-11-13T09:00:00.000Z',
      '2026-11-16T09:00:00.000Z',
      '2026-11-18T09:00:00.000Z',
      '2026-11-20T09:00:00.000Z',
    ]);
  });

  it('n: 1 devolve só a próxima', () => {
    const out = proximos(SABADO_630, new Date('2026-11-14T09:00:00Z'), { n: 1 });
    expect(iso(out)).toEqual(['2026-11-14T09:30:00.000Z']);
  });

  it("aceita start_time 'HH:MM:SS' do pg como 'HH:MM'", () => {
    const now = new Date('2026-11-14T09:00:00Z');
    expect(iso(proximos({ days: ['sab'], start_time: '06:30:00' }, now))).toEqual(
      iso(proximos(SABADO_630, now)),
    );
  });

  it('respeita outro fuso quando informado', () => {
    const out = proximos(SABADO_630, new Date('2026-11-13T20:00:00Z'), {
      n: 1,
      timeZone: 'Asia/Tokyo',
    });
    expect(out[0].toISOString()).toBe('2026-11-13T21:30:00.000Z');
  });

  it('acompanha um fuso com horário de verão (deslocamento lido na data)', () => {
    // Nova York: -04:00 até 1º/11/2026, -05:00 depois.
    const out = proximos(
      { days: ['sab', 'dom'], start_time: '06:30' },
      new Date('2026-10-31T00:00:00Z'),
      {
        n: 2,
        timeZone: 'America/New_York',
      },
    );
    expect(iso(out)).toEqual(['2026-10-31T10:30:00.000Z', '2026-11-01T11:30:00.000Z']);
  });

  it('não chama Date.now()', () => {
    const spy = vi.spyOn(Date, 'now');
    try {
      proximos(SABADO_630, new Date('2026-11-14T09:00:00Z'));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it.each([[{ days: ['sab'], start_time: '6:30' }], [{ days: ['xxx'], start_time: '06:30' }]])(
    'lança RangeError para grupo inválido %j',
    (group) => {
      expect(() => proximos(group, new Date('2026-11-14T09:00:00Z'))).toThrow(RangeError);
    },
  );
});

describe('proximos não depende do fuso do processo (CA9)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['UTC', 'Asia/Tokyo', 'America/Los_Angeles'])('com TZ=%s o resultado é o mesmo', (tz) => {
    vi.stubEnv('TZ', tz);
    // Confere que a troca de TZ pegou no processo; senão o teste não provaria nada.
    const expectedOffset = { UTC: 0, 'Asia/Tokyo': -540, 'America/Los_Angeles': 480 }[tz];
    expect(new Date('2026-11-14T12:00:00Z').getTimezoneOffset()).toBe(expectedOffset);

    expect(iso(proximos(SABADO_630, new Date('2026-11-14T09:00:00Z')))).toEqual([
      '2026-11-14T09:30:00.000Z',
      '2026-11-21T09:30:00.000Z',
      '2026-11-28T09:30:00.000Z',
      '2026-12-05T09:30:00.000Z',
    ]);
    expect(
      proximos({ days: ['sab'], start_time: '23:00' }, new Date('2026-11-15T01:00:00Z'))[0],
    ).toEqual(new Date('2026-11-15T02:00:00.000Z'));
    expect(fmtEncontro(new Date('2026-11-15T02:00:00Z'))).toEqual({
      dia: '14',
      mes: 'nov',
      semana: 'Sábado',
    });
  });
});

describe('fmtEncontro', () => {
  it('formata no fuso de SP, mesmo quando em UTC já é o dia seguinte', () => {
    expect(fmtEncontro(new Date('2026-11-15T02:00:00Z'))).toEqual({
      dia: '14',
      mes: 'nov',
      semana: 'Sábado',
    });
  });

  it('dia da semana com hífen e dia sem zero à esquerda', () => {
    expect(fmtEncontro(new Date('2026-11-16T09:00:00Z')).semana).toBe('Segunda-feira');
    expect(fmtEncontro(new Date('2026-12-05T09:30:00Z'))).toEqual({
      dia: '5',
      mes: 'dez',
      semana: 'Sábado',
    });
  });
});
