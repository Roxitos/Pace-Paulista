// Paths copiados do objeto P do protótipo.
const ICONS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6l-12 12M6 6l12 12"/>',
  check: '<path d="M5 12l5 5l10 -10"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
};

export const ic = (name, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// Ctrl/Cmd/Shift/Alt+clique e botão do meio ficam com o navegador (nova aba/janela),
// como num link sem JS; só o clique simples vira atualização ao vivo.
export const isPlainClick = (e) =>
  !e.defaultPrevented && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;

let toastTimer;

export function toast(msg) {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const box = document.createElement('div');
  box.className = 'toast';
  box.innerHTML = ic('check');
  const span = document.createElement('span');
  span.textContent = msg;
  box.append(span);
  root.replaceChildren(box);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => root.replaceChildren(), 3200);
}
