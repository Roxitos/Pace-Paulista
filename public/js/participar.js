import { ic, isPlainClick } from './ui.js';

const panel = document.getElementById('participar');
const head = document.querySelector('.detail-head');
const modalRoot = document.getElementById('modalRoot');

if (panel && head && modalRoot) init();

function init() {
  const wasOpen = panel.classList.contains('open');
  // --z/--zon herdados da .detail-grid; lidos do próprio painel (já garantido) antes de tirá-lo.
  const zoneVars = getComputedStyle(panel);
  const z = zoneVars.getPropertyValue('--z');
  const zon = zoneVars.getPropertyValue('--zon');

  // O painel do servidor vira o corpo do modal: mesmos nós, mesmo que já foi digitado.
  panel.querySelector('h2')?.remove();
  const content = [...panel.childNodes];
  panel.remove();

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.dataset.act = 'modal-bg';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'mTitle');
  modal.style.setProperty('--z', z);
  modal.style.setProperty('--zon', zon);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-x';
  closeBtn.dataset.act = 'close-modal';
  closeBtn.setAttribute('aria-label', 'Fechar');
  closeBtn.innerHTML = ic('x');

  const top = document.createElement('div');
  top.className = 'modal-top';
  const chip = head.querySelector('.zchip')?.cloneNode(true);
  if (chip) {
    chip.style.background = 'var(--zon)';
    chip.style.color = 'var(--z)';
    top.append(chip);
  }
  const title = document.createElement('h2');
  title.id = 'mTitle';
  title.textContent = `Entrar no ${head.querySelector('h1').textContent}`;
  top.append(title);

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.id = 'joinBody';
  body.append(...content);

  modal.append(closeBtn, top, body);
  bg.append(modal);

  let lastFocus = null;
  const isOpen = () => bg.isConnected;

  function initialFocus() {
    const form = body.querySelector('form');
    if (!form) return modal.querySelector('.btn');
    const withError = form.querySelector('[aria-invalid="true"]');
    if (withError) return withError;
    if (form.querySelector('#e-jok')?.textContent.trim()) return form.querySelector('#j-ok');
    return form.querySelector('#j-nome');
  }

  function openModal() {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    modalRoot.replaceChildren(bg);
    document.body.style.overflow = 'hidden';
    initialFocus()?.focus();
  }

  function closeModal() {
    if (!isOpen()) return;
    modalRoot.replaceChildren();
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname + location.search);
    const back =
      lastFocus && lastFocus !== document.body && document.contains(lastFocus)
        ? lastFocus
        : document.getElementById('view');
    back?.focus();
  }

  bg.addEventListener('click', (e) => {
    if (e.target === bg || e.target.closest('[data-act="close-modal"]')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      closeModal();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [
      ...modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled])',
      ),
    ];
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === first || !modal.contains(document.activeElement))
    ) {
      e.preventDefault();
      last.focus();
    } else if (
      !e.shiftKey &&
      (document.activeElement === last || !modal.contains(document.activeElement))
    ) {
      e.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="#participar"]');
    if (!link || !isPlainClick(e)) return;
    e.preventDefault();
    openModal();
  });

  const form = body.querySelector('form');
  const joinBtn = body.querySelector('#joinBtn');
  const joinLabel = joinBtn?.textContent;

  function setError(id, input, msg) {
    const el = body.querySelector(id);
    el.innerHTML = msg ? ic('alert', 'ico-sm') : '';
    if (msg) el.append(document.createTextNode(msg));
    input?.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  form?.addEventListener('submit', (e) => {
    const nome = form.elements.apelido;
    const ok = form.elements.ok;
    const nomeMsg =
      [...nome.value.trim()].length < 2
        ? 'Informe um nome ou apelido com pelo menos 2 letras.'
        : '';
    const okMsg = ok.checked ? '' : 'Confirme que leu as orientações.';
    setError('#e-jnome', nome, nomeMsg);
    setError('#e-jok', null, okMsg);
    if (nomeMsg || okMsg) {
      e.preventDefault();
      (nomeMsg ? nome : ok).focus();
      return;
    }
    joinBtn.disabled = true;
    joinBtn.innerHTML = '<span class="spinner"></span> Entrando…';
  });

  // Voltar pelo histórico restaura a página do cache com o botão preso em "Entrando…".
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || !joinBtn) return;
    joinBtn.disabled = false;
    joinBtn.textContent = joinLabel;
  });

  if (wasOpen || location.hash === '#participar') openModal();
}
