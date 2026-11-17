import { describe, expect, it } from 'vitest';
import { isPlainClick } from '../../public/js/ui.js';

// ui.js só toca o DOM dentro de toast(); a função testada aqui é pura.
describe('isPlainClick', () => {
  const click = (extra = {}) => ({
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...extra,
  });

  it('só o clique simples do botão principal é interceptado; modificadores abrem o link normal', () => {
    expect(isPlainClick(click())).toBe(true);
    for (const extra of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
      { defaultPrevented: true },
    ]) {
      expect(isPlainClick(click(extra))).toBe(false);
    }
  });
});
