(() => {
  const examples = [
    { id: 'paper', name: 'Бумага', bg: '#fbf1c7', ink: '#282828', accent: '#d65d0e' },
    { id: 'night', name: 'Полночь', bg: '#1d2021', ink: '#ebdbb2', accent: '#fabd2f' },
    { id: 'focus', name: 'Фокус', bg: '#f9f5d7', ink: '#504945', accent: '#79740e' },
    { id: 'terminal', name: 'Терминал', bg: '#282828', ink: '#b8bb26', accent: '#8ec07c' },
  ];
  const frame = document.querySelector('.popup-preview');
  const grid = frame.querySelector('.static-grid');
  const tabs = [...frame.querySelectorAll('[data-demo-tab]')];
  const display = frame.querySelector('#demo-appearance');
  const development = frame.querySelector('#demo-development');
  const library = frame.querySelector('.static-library');
  const all = frame.querySelector('[data-demo-all]');
  let activeTab = 'appearance';
  let showAll = false;

  function updateSelection(index) {
    document.querySelector('.demo-browser').dataset.appearance = examples[index]?.id ?? 'original';
    [...grid.children].forEach((card, position) => {
      const active = position === index;
      card.classList.toggle('active', active);
      card.setAttribute('aria-checked', String(active));
      card.tabIndex = active || index === null && position === 0 ? 0 : -1;
      card.querySelector('.static-name > span').innerHTML = active ? forge.icon('check') : '';
    });
    frame.querySelector('[data-demo-original] > span:last-child').textContent = index === null ? '◉' : '○';
    frame.querySelector('[data-demo-export]').textContent = examples[index]?.name ?? 'Основа для текущего сайта';
    frame.querySelectorAll('[data-library-index]').forEach((row) => row.classList.toggle('active', Number(row.dataset.libraryIndex) === index));
  }

  function updatePanels() {
    display.hidden = activeTab !== 'appearance' || showAll;
    development.hidden = activeTab !== 'development';
    library.hidden = !showAll;
    all.setAttribute('aria-pressed', String(showAll));
    frame.querySelector('[data-demo-scope]').textContent = showAll ? 'Все сайты' : 'Только для этого сайта';
    frame.querySelector('.static-segmented').dataset.active = activeTab;
    tabs.forEach((tab) => {
      const active = tab.dataset.demoTab === activeTab;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.demoTab;
      showAll = false;
      updatePanels();
    });
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + 1) % tabs.length;
      tabs[next].click();
      tabs[next].focus();
    });
  });

  examples.forEach(({ name, bg, ink, accent }, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'static-card';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-label', name);
    card.innerHTML = `<div class="static-mini" aria-hidden="true" style="--mini-bg:${bg};--mini-ink:${ink};--mini-accent:${accent}"><b>тише.</b><strong>Оставить<br>самое важное.</strong><i></i><div></div></div><div class="static-name">${name}<span></span></div><div class="static-card-footer" aria-hidden="true"><span class="mono">1.0.0</span>${forge.icon('download')}${forge.icon('trash')}</div>`;
    card.addEventListener('click', () => updateSelection(index));
    card.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? examples.length - 1 : (index + direction + examples.length) % examples.length;
      updateSelection(next);
      grid.children[next].focus();
    });
    grid.append(card);
    const row = document.createElement('button');
    row.type = 'button';
    row.dataset.libraryIndex = index;
    row.className = 'static-library-row';
    row.innerHTML = `<b>${name}</b><span class="mono">journal.example</span>`;
    row.addEventListener('click', () => updateSelection(index));
    frame.querySelector('.static-library-list').append(row);
  });
  const other = document.createElement('div');
  other.className = 'static-library-row';
  other.innerHTML = '<b>Читалка</b><span class="mono">docs.example</span>';
  frame.querySelector('.static-library-list').append(other);
  frame.querySelector('[data-demo-original]').addEventListener('click', () => updateSelection(null));
  all.addEventListener('click', () => {
    showAll = !showAll;
    activeTab = 'appearance';
    updatePanels();
  });
  frame.querySelector('[data-demo-back]').addEventListener('click', () => {
    showAll = false;
    updatePanels();
  });
  updateSelection(0);
  updatePanels();
})();
