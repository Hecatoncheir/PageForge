(() => {
  async function updateDownloads() {
    try {
      const response = await fetch('https://api.github.com/repos/Hecatoncheir/PageForge/releases?per_page=100', { credentials: 'omit', signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      const releases = await response.json();
      if (!Array.isArray(releases)) return;
      const published = releases.filter((release) => !release.draft && release.published_at && Array.isArray(release.assets))
        .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
      const latest = published.find((release) => ['chrome', 'firefox'].every((browser) => release.assets.some((asset) => new RegExp(`^pageforge-${browser}-\\d+\\.\\d+\\.\\d+\\.zip$`).test(asset.name))));
      if (!latest) return;
      for (const link of document.querySelectorAll('[data-browser-download]')) {
        const browser = link.dataset.browserDownload;
        const asset = latest.assets.find((item) => new RegExp(`^pageforge-${browser}-\\d+\\.\\d+\\.\\d+\\.zip$`).test(item.name));
        const url = new URL(asset.browser_download_url);
        if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/Hecatoncheir/PageForge/releases/download/')) continue;
        link.href = url.href;
      }
      document.querySelector('[data-release-version]').textContent = `${latest.tag_name}${latest.prerelease ? ' · ПРЕВЬЮ' : ''}`;
    } catch { /* При недоступности GitHub остаются ссылки на известный выпуск. */ }
  }
  void updateDownloads();
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
    frame.querySelectorAll('[data-library-index]').forEach((row) => {
      const selected = Number(row.dataset.libraryIndex) === index;
      row.classList.toggle('active', selected);
      row.querySelector('[data-library-status]').textContent = selected ? 'Выбрано' : 'Не выбрано';
    });
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
    row.innerHTML = `<span class="static-library-info"><b>${name}</b><span class="mono">journal.example</span><small data-library-status>Не выбрано</small></span><span class="static-library-check" aria-hidden="true">${forge.icon('check')}</span>`;
    row.prepend(card.querySelector('.static-mini').cloneNode(true));
    row.addEventListener('click', () => updateSelection(index));
    frame.querySelector('.static-library-list').append(row);
  });
  const other = document.createElement('div');
  other.className = 'static-library-row active';
  other.innerHTML = `<span class="static-library-info"><b>Читалка</b><span class="mono">docs.example</span><small>Выбрано</small></span><span class="static-library-check" aria-hidden="true">${forge.icon('check')}</span>`;
  other.prepend(grid.children[2].querySelector('.static-mini').cloneNode(true));
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
