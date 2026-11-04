(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  if (!api?.runtime?.id) document.documentElement.classList.add('standalone');
  const explicitTab = Number(new URLSearchParams(location.search).get('tab')) || null;
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.zip,application/zip'; input.hidden = true;
  input.id = 'pageforge-fileinput'; document.body.append(input);
  let listener;
  let dropEnabled = false;
  let dragging = false;
  const emit = (event) => listener?.(JSON.stringify(event));
  const encode = (value) => {
    let result = '';
    for (let index = 0; index < value.length; index += 8192) result += String.fromCharCode(...value.subarray(index, index + 8192));
    return btoa(result);
  };

  async function command(name, args = {}) {
    if (name === 'drop-enabled') { dropEnabled = args.enabled; return {}; }
    if (!api?.runtime?.id) return standaloneCommand(name, args);
    await requestPermission(name, args);
    const response = await api.runtime.sendMessage({ type: 'pageforge:command', command: name, args: { ...(explicitTab ? { tabId: explicitTab } : {}), ...args } });
    if (response?.error) throw new Error(response.error);
    return response?.data ?? {};
  }

  function standaloneCommand(name, args) {
    if (name === 'state') return { extension: false, supported: false, tabId: -1, siteLabel: 'Предпросмотр интерфейса', version: 'dev', theme: localStorage.getItem('pageforge-theme') ?? 'dark', profiles: [] };
    if (name === 'theme') { localStorage.setItem('pageforge-theme', args.theme); return {}; }
    throw new Error('Загрузите собранное расширение в браузер');
  }

  function permissionFor(name, args) {
    if (name === 'select' && args.id) {
      return { origins: [args.originPattern], error: 'Доступ к сайту не предоставлен' };
    }
    if (name === 'import-repository') {
      PageForgeRepositories.source(args.url);
      return { origins: PageForgeRepositories.origins, error: 'Для загрузки оформления нужен доступ к GitHub' };
    }
    if (name === 'update-profile') {
      return { origins: PageForgeRepositories.origins, error: 'Для обновления оформления нужен доступ к GitHub' };
    }
    if (name === 'check-updates') {
      return { origins: [PageForgeRepositories.origins[0]], error: 'Для проверки релизов нужен доступ к GitHub' };
    }
    return null;
  }

  async function requestPermission(name, args) {
    const permission = permissionFor(name, args);
    if (!permission) return;
    // Запрос начинается до первого await, пока действует жест пользователя.
    if (!await api.permissions.request({ origins: permission.origins })) throw new Error(permission.error);
  }

  async function importFile(file, tabId) {
    if (!file || !file.name.toLowerCase().endsWith('.zip')) throw new Error('Выберите ZIP-архив');
    if (file.size > 8 * 1024 * 1024) throw new Error('Размер ZIP — до 8 МБ');
    return command('import', { tabId, archive: encode(new Uint8Array(await file.arrayBuffer())) });
  }

  const result = async (operation) => {
    try { return JSON.stringify(await operation()); }
    catch (error) { return JSON.stringify({ error: error.message ?? 'Не удалось выполнить действие' }); }
  };
  globalThis.pageForge = Object.freeze({
    command: (name, args) => result(() => command(name, JSON.parse(args))),
    getContext: () => result(() => command('state')),
    subscribe: (callback) => { listener = callback; },
    chooseArchive: (tabId) => result(() => new Promise((resolve, reject) => {
      input.value = '';
      input.oncancel = () => resolve({ cancelled: true });
      input.onchange = () => { void importFile(input.files[0], tabId).then(resolve, reject); };
      input.click();
    })),
  });

  function overDropArea(event) {
    if (!dropEnabled) return false;
    const element = document.querySelector('[flt-semantics-identifier="pageforge-import"]');
    const bounds = element?.getBoundingClientRect();
    return bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  }
  function setDragging(value) {
    if (dragging === value) return;
    dragging = value;
    emit({ event: 'drag', value });
  }
  document.addEventListener('dragover', (event) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragging(Boolean(overDropArea(event)));
    event.dataTransfer.dropEffect = dragging ? 'copy' : 'none';
  });
  document.addEventListener('dragleave', (event) => { if (!event.relatedTarget) setDragging(false); });
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    const accepted = overDropArea(event);
    // FileList доступен только во время drop. Сам File сохраняем до первого await.
    const file = event.dataTransfer?.files[0];
    setDragging(false);
    if (!accepted) return;
    emit({ event: 'start' });
    void command('state').then((state) => importFile(file, state.tabId)).then(
      (data) => emit({ event: 'done', ...data }),
      (error) => emit({ event: 'done', error: error.message }),
    );
  });
})();

