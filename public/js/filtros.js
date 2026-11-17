import { ic, isPlainClick, toast } from './ui.js';

const form = document.getElementById('filters');

if (form) {
  const count = document.getElementById('count');
  const chips = document.getElementById('chips');
  const results = document.getElementById('results');
  const MIN_SKELETON_MS = 260;
  const DEBOUNCE_MS = 220;
  let controller = null;
  let debounceTimer;

  count.setAttribute('tabindex', '-1');

  const apply = form.querySelector('button[type="submit"]');
  if (apply) apply.hidden = true;

  const filterLabel = (text) => `${ic('filter', 'ico-sm')} ${text}`;
  let toggle = document.querySelector('a.filters-toggle');
  if (toggle) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline btn-sm filters-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-controls', 'filters');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = filterLabel('Filtros');
    toggle.replaceWith(btn);
    toggle = btn;
    toggle.addEventListener('click', () => {
      const open = form.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = filterLabel(open ? 'Ocultar filtros' : 'Filtros');
    });
  }

  const SKELETON = `<div class="grid-cards" aria-busy="true">${[1, 2, 3]
    .map(
      () =>
        '<div class="skeleton"><div class="sk" style="width:35%"></div><div class="sk" style="height:26px;width:70%"></div><div class="sk"></div><div class="sk" style="width:80%"></div><div class="sk" style="height:40px"></div></div>',
    )
    .join('')}</div>`;

  const formQuery = () => new URLSearchParams(new FormData(form)).toString();

  async function update() {
    clearTimeout(debounceTimer);
    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    const query = formQuery();
    results.innerHTML = SKELETON;
    try {
      const wait = new Promise((resolve) => setTimeout(resolve, MIN_SKELETON_MS));
      const [res] = await Promise.all([
        fetch(`/api/grupos?${query}`, {
          headers: { Accept: 'application/json' },
          signal: mine.signal,
        }),
        wait,
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (controller !== mine) return;
      count.textContent = data.countText;
      chips.innerHTML = data.chips;
      results.innerHTML = data.results;
      history.replaceState(null, '', data.query ? `/grupos?${data.query}` : '/grupos');
    } catch (err) {
      if (err.name === 'AbortError' || controller !== mine) return;
      location.assign(`/grupos?${query}`);
    }
  }

  function setFromParams(params) {
    for (const cb of form.querySelectorAll('input[name="zona"]')) {
      cb.checked = params.getAll('zona').includes(cb.value);
    }
    for (const field of form.querySelectorAll('input[type="search"], select')) {
      field.value = params.get(field.name) ?? '';
    }
  }

  form.addEventListener('change', update);
  form.addEventListener('input', (e) => {
    if (e.target.matches('input[type="search"]')) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(update, DEBOUNCE_MS);
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    update();
  });

  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('a.achip');
    if (!chip || !isPlainClick(e)) return;
    e.preventDefault();
    setFromParams(new URL(chip.href).searchParams);
    count.focus();
    update();
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="/grupos"]');
    if (!link || !isPlainClick(e) || !(form.contains(link) || results.contains(link))) return;
    e.preventDefault();
    setFromParams(new URLSearchParams());
    if (results.contains(link)) count.focus();
    update();
    toast('Filtros limpos. Mostrando todos os grupos.');
  });
}
