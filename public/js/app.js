import { ic } from './ui.js';

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
