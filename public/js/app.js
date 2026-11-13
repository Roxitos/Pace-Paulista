// Paths copiados do objeto P do protótipo (ícones menu e x).
const ICONS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6l-12 12M6 6l12 12"/>',
};
const ic = (name) =>
  `<svg class="ico " viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

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
