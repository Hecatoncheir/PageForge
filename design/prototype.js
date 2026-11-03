(() => {
  const params = new URLSearchParams(location.search);
  if (params.has('embed')) document.documentElement.classList.add('is-embedded');
  const defaults = [
    { id: 'paper', name: 'Бумага', version: '1.0.0', style: 'paper', colors: ['#fbf1c7', '#282828', '#d65d0e'] },
    { id: 'night', name: 'Полночь', version: '1.0.0', style: 'night', colors: ['#1d2021', '#ebdbb2', '#fabd2f'] },
    { id: 'focus', name: 'Фокус', version: '1.0.0', style: 'focus', colors: ['#f9f5d7', '#504945', '#79740e'] },
    { id: 'terminal', name: 'Терминал', version: '1.0.0', style: 'terminal', colors: ['#282828', '#b8bb26', '#8ec07c'] },
  ];
  const stateKey = 'pageforge-prototype-v1';
  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(stateKey));
      if (stored && Array.isArray(stored.profiles) && stored.profiles.length <= 50) {
        stored.profiles.forEach(validateProfile);
        return stored;
      }
    } catch { /* Повреждённое состояние заменяется демонстрационными данными. */ }
    return { profiles: defaults, selected: 'paper' };
  }
  const state = readState();
  const grid = document.querySelector('.appearance-grid');
  const original = document.querySelector('#original-option');
  const fileInput = document.querySelector('#zip-input');
  const dropArea = document.querySelector('#add-zip');

  function validateProfile(profile) {
    if (!profile || typeof profile.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(profile.id)) throw new Error('Проверьте идентификатор в profile.json');
    if (typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 60) throw new Error('Нужно название длиной до 60 символов');
    if (typeof profile.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(profile.version)) throw new Error('Версия должна иметь вид 1.0.0');
    if (!Array.isArray(profile.colors) || profile.colors.length !== 3 || !profile.colors.every((color) => /^#[a-f\d]{6}$/i.test(color))) throw new Error('Нужны три цвета в формате #RRGGBB');
  }

  function currentProfile() { return state.profiles.find((profile) => profile.id === state.selected); }
  function persist() { localStorage.setItem(stateKey, JSON.stringify(state)); }

  function applySelection(id, announce = true) {
    state.selected = id;
    persist();
    grid.querySelectorAll('.appearance-card').forEach((card) => {
      const selected = card.dataset.id === id;
      card.classList.toggle('selected', selected);
      card.querySelector('.appearance-choice').setAttribute('aria-checked', String(selected));
    });
    original.classList.toggle('selected', id === 'original');
    const profile = currentProfile();
    document.querySelector('#export-description').textContent = profile ? profile.name : 'Основа для journal.example';
    if (window.parent !== window) window.parent.postMessage({ type: 'pageforge:appearance', appearance: profile?.style ?? 'original' }, location.origin === 'null' ? '*' : location.origin);
    if (announce) forge.notify(profile ? `${profile.name} · применено` : 'Исходное отображение');
  }

  function renderProfiles() {
    grid.replaceChildren();
    state.profiles.forEach((profile) => {
      const card = document.createElement('article');
      card.className = 'appearance-card';
      card.dataset.id = profile.id;
      card.innerHTML = `<button class="appearance-choice" role="radio" aria-checked="false"><div class="mini-page"><div class="mini-nav">тише.<i></i></div><div class="mini-heading">Оставить самое важное.</div><div class="mini-lines"></div><div class="mini-art"></div></div><span class="appearance-name"><span class="name"></span><span class="selection-dot">${forge.icon('check')}</span></span></button><div class="card-footer"><span class="mono"></span><button data-action="export">${forge.icon('download')}</button><button data-action="delete">${forge.icon('trash')}</button></div>`;
      const preview = card.querySelector('.mini-page');
      ['bg', 'ink', 'accent'].forEach((key, index) => preview.style.setProperty(`--preview-${key}`, profile.colors[index]));
      preview.dataset.style = ['paper', 'night', 'focus', 'terminal'].includes(profile.style) ? profile.style : 'paper';
      card.querySelector('.name').textContent = profile.name;
      card.querySelector('.mono').textContent = profile.version;
      card.querySelector('.appearance-choice').setAttribute('aria-label', profile.name);
      card.querySelector('.appearance-choice').addEventListener('click', () => applySelection(profile.id));
      const exportButton = card.querySelector('[data-action="export"]');
      exportButton.setAttribute('aria-label', `Выгрузить ${profile.name}`);
      exportButton.title = 'Выгрузить';
      exportButton.addEventListener('click', () => exportProfile(profile));
      const deleteButton = card.querySelector('[data-action="delete"]');
      deleteButton.setAttribute('aria-label', `Удалить ${profile.name}`);
      deleteButton.title = 'Удалить';
      deleteButton.addEventListener('click', () => {
        state.profiles = state.profiles.filter((item) => item.id !== profile.id);
        if (state.selected === profile.id) state.selected = 'original';
        renderProfiles();
        forge.notify(`${profile.name} · удалено`);
      });
      grid.append(card);
    });
    applySelection(currentProfile() ? state.selected : 'original', false);
  }

  function selectTab(name) {
    const development = name === 'development';
    document.querySelector('.segmented').dataset.active = name;
    document.querySelectorAll('[role="tab"]').forEach((button) => {
      const selected = button.dataset.tab === name;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelector('#appearance-panel').hidden = development;
    document.querySelector('#development-panel').hidden = !development;
    forge.animate(document.querySelector(development ? '#development-panel' : '#appearance-panel'));
  }
  document.querySelectorAll('[role="tab"]').forEach((button) => {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'appearance' : event.key === 'End' ? 'development' : button.dataset.tab === 'appearance' ? 'development' : 'appearance';
      selectTab(next);
      document.querySelector(`[data-tab="${next}"]`).focus();
    });
  });
  original.addEventListener('click', () => applySelection('original'));

  function exportProfile(profile, sample = false) {
    const selected = profile ?? { id: `my-appearance-${Date.now()}`, name: 'Мой вариант', version: '1.0.0', style: 'paper', colors: ['#fbf1c7', '#282828', '#d65d0e'] };
    const css = selected.css ?? `:root {\n  --preview-bg: ${selected.colors[0]};\n  --preview-ink: ${selected.colors[1]};\n  --preview-accent: ${selected.colors[2]};\n}\n\n/* Здесь будет оформление сайта. */\n`;
    const manifest = { schemaVersion: 1, ...selected, site: 'journal.example' };
    delete manifest.css;
    const files = {
      'profile.json': JSON.stringify(manifest, null, 2),
      'styles.css': css,
      'layout.html': '<main class="pageforge-layout"><!-- Содержимое сайта --></main>\n',
      'rules.json': JSON.stringify({ mode: 'prototype', bindings: [] }, null, 2),
      'reference/page.html': '<!doctype html><html lang="ru"><title>Демонстрационная страница</title><body><h1>Оставить самое важное.</h1></body></html>\n',
      'README.txt': 'Это пакет интерактивного прототипа PageForge.\nИзмените name и id в profile.json. Цвета превью задаются в styles.css через --preview-bg, --preview-ink, --preview-accent.\nHTML и CSS из архива не выполняются на реальных сайтах. Финальный формат расширения будет уточнён.\n',
    };
    const encoded = Object.fromEntries(Object.entries(files).map(([name, value]) => [name, fflate.strToU8(value)]));
    const zip = fflate.zipSync(encoded, { level: 6 });
    forge.download(`${sample ? 'example-' : ''}${selected.id}.zip`, zip);
    forge.notify('ZIP готов');
  }

  async function importFile(file) {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('Нужен ZIP-архив');
      if (file.size > 8 * 1024 * 1024) throw new Error('Размер ZIP — до 8 МБ');
      let entries = 0;
      let total = 0;
      const files = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter(entry) {
          entries += 1;
          total += entry.originalSize;
          if (entries > 50 || total > 16 * 1024 * 1024) throw new Error('Архив слишком большой');
          if (entry.name.startsWith('/') || entry.name.includes('..') || entry.name.includes('\\')) throw new Error('Недопустимые пути в ZIP');
          return ['profile.json', 'styles.css'].includes(entry.name);
        },
      });
      if (!files['profile.json'] || !files['styles.css']) throw new Error('В корне ZIP нужны profile.json и styles.css');
      const manifest = JSON.parse(fflate.strFromU8(files['profile.json']));
      if (manifest.schemaVersion !== 1) throw new Error('Неподдерживаемая версия пакета');
      if (manifest.site !== 'journal.example') throw new Error('Прототип принимает варианты для journal.example');
      const css = fflate.strFromU8(files['styles.css']);
      if (css.length > 64 * 1024) throw new Error('В прототипе styles.css ограничен 64 КБ');
      const keys = ['bg', 'ink', 'accent'];
      const colors = keys.map((key, index) => css.match(new RegExp(`--preview-${key}\\s*:\\s*(#[a-fA-F0-9]{6})(?=\\s*[;}])`))?.[1] ?? manifest.colors?.[index]);
      const profile = { id: manifest.id, name: manifest.name, version: manifest.version, style: manifest.style, colors, css };
      validateProfile(profile);
      const existing = state.profiles.findIndex((item) => item.id === profile.id);
      if (existing < 0 && state.profiles.length >= 50) throw new Error('В прототипе можно хранить до 50 вариантов');
      if (existing < 0) state.profiles.push(profile);
      else state.profiles[existing] = profile;
      renderProfiles();
      selectTab('appearance');
      forge.notify(existing < 0 ? 'Вариант добавлен · превью готово' : 'Вариант обновлён');
    } catch (error) {
      forge.notify(error instanceof Error ? error.message : 'Не удалось прочитать ZIP');
    } finally {
      fileInput.value = '';
      dropArea.classList.remove('dragover');
    }
  }
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => importFile(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((name) => dropArea.addEventListener(name, (event) => {
    event.preventDefault();
    dropArea.classList.add('dragover');
  }));
  dropArea.addEventListener('dragleave', (event) => {
    if (!dropArea.contains(event.relatedTarget)) dropArea.classList.remove('dragover');
  });
  dropArea.addEventListener('drop', (event) => {
    event.preventDefault();
    importFile(event.dataTransfer.files[0]);
  });
  document.querySelector('#export-zip').addEventListener('click', () => exportProfile(currentProfile()));
  document.querySelector('#sample-zip').addEventListener('click', () => exportProfile({ ...defaults[0], id: 'my-paper', name: 'Моя бумага' }, true));
  renderProfiles();
})();
