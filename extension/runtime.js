(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const profiles = PageForgeProfiles;
  const store = PageForgeStore;
  const queues = new Map();
  let mutationQueue = Promise.resolve();
  let registrationQueue = Promise.resolve();

  function queue(tabId, operation) {
    const task = (queues.get(tabId) ?? Promise.resolve()).catch(() => {}).then(operation);
    queues.set(tabId, task);
    void task.finally(() => { if (queues.get(tabId) === task) queues.delete(tabId); }).catch(() => {});
    return task;
  }

  function mutate(operation) {
    const task = mutationQueue.catch(() => {}).then(operation);
    mutationQueue = task;
    return task;
  }

  function supported(tab) { return Boolean(tab?.url && /^https?:\/\//i.test(tab.url)); }
  function originPattern(address) { const url = new URL(address); return `${url.protocol}//${url.hostname}/*`; }
  async function settings() { return { selections: {}, theme: 'dark', ...await api.storage.local.get(['selections', 'theme']) }; }

  async function target(tabId) {
    const tab = Number.isInteger(tabId) ? await api.tabs.get(tabId) : (await api.tabs.query({ active: true, currentWindow: true }))[0];
    if (!tab) throw new Error('Не удалось найти вкладку');
    return tab;
  }

  async function engine(tabId, action, payload) {
    const response = await api.tabs.sendMessage(tabId, { type: 'pageforge:engine', action, payload });
    if (response?.error) throw new Error(response.error);
    return response?.data;
  }

  async function ensureEngine(tabId) {
    await api.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }

  async function writePayload(tabId, payload) {
    if (payload?.css) await api.scripting.insertCSS({ target: { tabId }, css: payload.css, origin: 'USER' });
    try { if (payload) await engine(tabId, 'apply', payload); }
    catch (error) {
      if (payload?.css) await api.scripting.removeCSS({ target: { tabId }, css: payload.css, origin: 'USER' });
      await engine(tabId, 'clear');
      throw error;
    }
  }

  async function replacePayload(tabId, payload) {
    await ensureEngine(tabId);
    const previous = await engine(tabId, 'current');
    if (previous?.css) await api.scripting.removeCSS({ target: { tabId }, css: previous.css, origin: 'USER' });
    await engine(tabId, 'clear');
    try { await writePayload(tabId, payload); }
    catch (error) { await writePayload(tabId, previous); throw error; }
  }

  async function selectedProfile(tab) {
    const { selections } = await settings();
    const id = selections[new URL(tab.url).origin];
    const selected = id ? await store.get(id) : null;
    return selected && profiles.matches(selected.matches, tab.url) ? selected : null;
  }

  async function applySelection(tabId) {
    const tab = await target(tabId);
    if (!supported(tab)) return;
    if (!await api.permissions.contains({ origins: [originPattern(tab.url)] })) return;
    const profile = await selectedProfile(tab);
    await ensureEngine(tabId);
    const current = await engine(tabId, 'current');
    if (!profile && !current) return;
    if (current?.id === profile?.id && current?.revision === profile?.updatedAt) return;
    const payload = profile ? { ...profiles.payload(profile), revision: profile.updatedAt } : null;
    await replacePayload(tabId, payload);
  }

  async function updateOrigin(origin) {
    const tabs = await api.tabs.query({});
    await Promise.all(tabs.filter((tab) => supported(tab) && new URL(tab.url).origin === origin).map((tab) => queue(tab.id, () => applySelection(tab.id)).catch(() => {})));
  }

  async function thumbnail(dataUrl) {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return dataUrl;
    const source = new Blob([profiles.fromBase64(dataUrl.slice(dataUrl.indexOf(',') + 1))], { type: 'image/jpeg' });
    const bitmap = await createImageBitmap(source);
    const canvas = new OffscreenCanvas(480, Math.max(1, Math.round(bitmap.height * 480 / bitmap.width)));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.76 });
    return `data:image/jpeg;base64,${profiles.toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
  }

  async function preview(tabId, profileId) {
    const profile = await store.get(profileId);
    const tab = await target(tabId);
    if (!profile || !supported(tab) || !tab.active || !profiles.matches(profile.matches, tab.url)) return;
    const address = tab.url;
    let previous;
    let viewport;
    let changed = false;
    try {
      await ensureEngine(tabId);
      previous = await engine(tabId, 'current');
      viewport = await engine(tabId, 'viewport');
      profile.previewState = 'capturing';
      profile.lastPreviewAttempt = Date.now();
      await store.put(profile);
      await replacePayload(tabId, { ...profiles.payload(profile), revision: profile.updatedAt });
      changed = true;
      await engine(tabId, 'ready');
      const currentTab = await target(tabId);
      if (!currentTab.active || currentTab.url !== address) throw new Error('Вкладка изменилась во время подготовки превью');
      const capture = await api.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 75 });
      const capturedTab = await target(tabId);
      if (!capturedTab.active || capturedTab.url !== address) throw new Error('Вкладка изменилась во время снимка');
      profile.preview = await thumbnail(capture);
      profile.previewState = 'ready';
      profile.previewError = null;
    } catch (error) {
      profile.previewState = 'pending';
      profile.previewError = 'Откройте сайт и расширение, чтобы подготовить превью';
      console.info(`PageForge: превью отложено (${error.message})`);
    } finally {
      if (changed) {
        const currentTab = await target(tabId).catch(() => null);
        if (currentTab?.url === address) {
          await replacePayload(tabId, previous).catch((error) => console.warn(error.message));
          if (viewport) await engine(tabId, 'scroll', viewport).catch(() => {});
        }
      }
      const latest = await store.get(profileId);
      if (latest?.updatedAt === profile.updatedAt) await store.put(profile);
    }
  }

  async function pendingPreviews(tabId, force = false) {
    const tab = await target(tabId);
    if (!supported(tab) || !tab.active) return;
    const available = await store.all();
    for (const profile of available) {
      if (profile.previewState === 'ready' || !profiles.matches(profile.matches, tab.url)) continue;
      if (!force && Date.now() - (profile.lastPreviewAttempt ?? 0) < 60000) continue;
      await queue(tabId, () => preview(tabId, profile.id));
    }
  }

  async function state(args) {
    const tab = await target(args.tabId);
    const preferences = await settings();
    const usable = supported(tab);
    const address = usable ? new URL(tab.url) : null;
    const available = usable ? (await store.all()).filter((profile) => profiles.matches(profile.matches, tab.url)) : [];
    const selectedId = usable ? preferences.selections[address.origin] : null;
    if (args.refreshPreview && usable) void pendingPreviews(tab.id, true).catch(() => {});
    return {
      tabId: tab.id, siteLabel: address?.hostname ?? 'Откройте обычную веб-страницу',
      url: usable ? tab.url : null, originPattern: usable ? originPattern(tab.url) : null,
      supported: usable, extension: true, theme: preferences.theme, version: api.runtime.getManifest().version,
      selectedId: available.some((profile) => profile.id === selectedId) ? selectedId : null,
      profiles: available.sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((profile) => ({
        id: profile.id, name: profile.name, version: profile.version,
        preview: profile.preview, previewState: profile.previewState, previewError: profile.previewError,
      })),
    };
  }

  async function importArchive(args) {
    const profile = profiles.decodeArchive(args.archive);
    profiles.payload(profile);
    await mutate(async () => {
      const available = (await store.all()).filter((item) => item.id !== profile.id);
      if (available.length >= profiles.LIMITS.profiles) throw new Error('Можно хранить до 50 оформлений');
      if (available.reduce((size, item) => size + item.size, profile.size) > profiles.LIMITS.storage) throw new Error('Хранилище оформлений заполнено (64 МБ)');
      await store.put(profile);
    });
    const tab = await target(args.tabId);
    if (supported(tab) && profiles.matches(profile.matches, tab.url)) await queue(tab.id, () => preview(tab.id, profile.id));
    const { selections } = await settings();
    for (const [origin, id] of Object.entries(selections)) if (id === profile.id) await updateOrigin(origin);
    return { message: 'Оформление добавлено', id: profile.id };
  }

  async function select(args) {
    const tab = await target(args.tabId);
    if (!supported(tab)) throw new Error('Эта страница не поддерживается браузером');
    const profile = args.id ? await store.get(args.id) : null;
    if (args.id && (!profile || !profiles.matches(profile.matches, tab.url))) throw new Error('Оформление не подходит этой странице');
    if (!await api.permissions.contains({ origins: [originPattern(tab.url)] })) throw new Error('Нужно разрешить доступ к этому сайту');
    await queue(tab.id, async () => {
      await replacePayload(tab.id, profile ? { ...profiles.payload(profile), revision: profile.updatedAt } : null);
      await mutate(async () => {
        const preferences = await settings();
        preferences.selections[new URL(tab.url).origin] = profile?.id ?? null;
        await api.storage.local.set({ selections: preferences.selections });
      });
    });
    await updateOrigin(new URL(tab.url).origin);
    return { message: profile ? 'Оформление применено' : 'Исходное отображение восстановлено' };
  }

  async function remove(args) {
    await mutate(async () => {
      const preferences = await settings();
      for (const origin of Object.keys(preferences.selections)) if (preferences.selections[origin] === args.id) preferences.selections[origin] = null;
      await api.storage.local.set({ selections: preferences.selections });
      await store.remove(args.id);
    });
    for (const tab of await api.tabs.query({})) if (supported(tab)) await queue(tab.id, () => applySelection(tab.id)).catch(() => {});
    return { message: 'Оформление удалено' };
  }

  async function exportArchive(args) {
    const tab = await target(args.tabId);
    let profile = args.id ? await store.get(args.id) : null;
    if (args.id && !profile) throw new Error('Оформление не найдено');
    if (!profile) {
      if (!supported(tab)) throw new Error('Откройте сайт для подготовки основы');
      profile = await queue(tab.id, async () => {
        await ensureEngine(tab.id);
        return profiles.starter(tab.url, await engine(tab.id, 'snapshot'));
      });
    }
    const archive = profiles.encodeArchive(profile);
    const domain = supported(tab) ? new URL(tab.url).hostname.replace(/[^a-z0-9.-]/gi, '_') : profile.id;
    const downloadId = await api.downloads.download({ url: `data:application/zip;base64,${profiles.toBase64(archive)}`, filename: `${domain}.zip`, conflictAction: 'uniquify', saveAs: false });
    return { message: 'ZIP подготовлен', downloadId };
  }

  async function updateRegistrations() {
    const { origins = [] } = await api.permissions.getAll();
    const matches = origins.filter((origin) => /^https?:\/\//.test(origin));
    const id = 'pageforge-sites';
    const registered = await api.scripting.getRegisteredContentScripts({ ids: [id] });
    if (registered.length) await api.scripting.unregisterContentScripts({ ids: [id] });
    if (matches.length) await api.scripting.registerContentScripts([{ id, matches, js: ['content.js'], runAt: 'document_end', persistAcrossSessions: true }]);
  }

  function registrations() {
    registrationQueue = registrationQueue.catch(() => {}).then(updateRegistrations);
    return registrationQueue;
  }

  async function start() {
    await registrations();
    for (const profile of await store.all()) if (profile.previewState === 'capturing') { profile.previewState = 'pending'; await store.put(profile); }
    for (const tab of await api.tabs.query({})) if (supported(tab)) void queue(tab.id, () => applySelection(tab.id)).catch(() => {});
  }

  async function handle(command, args = {}) {
    if (command === 'state') return state(args);
    if (command === 'import') return importArchive(args);
    if (command === 'select') return select(args);
    if (command === 'delete') return remove(args);
    if (command === 'export') return exportArchive(args);
    if (command === 'theme') { await api.storage.local.set({ theme: args.theme === 'light' ? 'light' : 'dark' }); return {}; }
    throw new Error('Неизвестная команда расширения');
  }

  api.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'complete' || change.url) void queue(tabId, () => applySelection(tabId)).catch(() => {});
  });
  api.tabs.onActivated.addListener(({ tabId }) => { void pendingPreviews(tabId).catch(() => {}); });
  api.permissions.onAdded.addListener(() => { void registrations().catch(console.warn); });
  api.permissions.onRemoved.addListener(() => { void registrations().catch(console.warn); });
  api.runtime.onInstalled.addListener(() => { void start().catch(console.warn); });
  globalThis.PageForgeRuntime = { handle, start, documentReady: (tabId) => queue(tabId, () => applySelection(tabId)) };
})();
