import { ic, toast } from './ui.js';

// Avisos fixos do servidor viram toast com JS; havendo mais de um, vale o último.
const toastEls = [...document.querySelectorAll('[data-toast]')];
if (toastEls.length) {
  toast(toastEls.at(-1).dataset.toast);
  toastEls.forEach((el) => el.remove());
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act="menu"]');
  if (!btn) return;
  const open = document.getElementById('hdr').classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
  btn.innerHTML = ic(open ? 'x' : 'menu');
});

// Contador de caracteres da descrição (cadastro de grupo).
const desc = document.getElementById('c-desc');
const descCount = document.getElementById('descCount');
if (desc && descCount) {
  desc.addEventListener('input', () => {
    descCount.textContent = [...desc.value].length;
  });
}
