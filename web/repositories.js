(() => {
  const origins = ['https://api.github.com/*', 'https://codeload.github.com/*'];

  function source(value) {
    let url;
    try { url = new URL(value.trim()); } catch { throw new Error('Введите ссылку на открытый репозиторий GitHub'); }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) {
      throw new Error('Нужна ссылка вида https://github.com/owner/repo');
    }
    const parts = url.pathname.replace(/\/+$/, '').split('/').slice(1);
    const [owner, originalName, kind, ...reference] = parts;
    const name = originalName?.replace(/\.git$/, '');
    if (!/^[a-z\d][a-z\d-]{0,38}$/i.test(owner ?? '') || !/^[a-z\d_-][a-z\d._-]{0,99}$/i.test(name ?? '')
      || parts.length > 2 && (!['tree', 'commit'].includes(kind) || !reference.length)) {
      throw new Error('Укажите репозиторий или ссылку на его ветку');
    }
    let ref;
    try { ref = reference.length ? decodeURIComponent(reference.join('/')) : 'HEAD'; } catch { throw new Error('Некорректная ссылка на ветку'); }
    if (!ref || ref.length > 200 || /[\s\\\x00-\x1f]/.test(ref)) throw new Error('Некорректная ссылка на ветку');
    return { archiveUrl: `https://api.github.com/repos/${owner}/${name}/zipball/${encodeURIComponent(ref)}` };
  }

  async function readArchive(response) {
    const limit = PageForgeProfiles.LIMITS.archive;
    if (Number(response.headers.get('content-length')) > limit) throw new Error('Архив репозитория должен быть не больше 8 МБ');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) throw new Error('Архив репозитория должен быть не больше 8 МБ');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const archive = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { archive.set(chunk, offset); offset += chunk.length; }
    return archive;
  }

  function unpack(archive) {
    const profiles = PageForgeProfiles;
    if (archive.length > profiles.LIMITS.archive) throw new Error('Архив репозитория должен быть не больше 8 МБ');
    let size = 0;
    let count = 0;
    const files = fflate.unzipSync(archive, { filter(entry) {
      size += entry.originalSize;
      count += 1;
      if (count > 512 || size > profiles.LIMITS.expanded) throw new Error('В репозитории слишком много данных');
      if (!profiles.safePath(entry.name)) throw new Error('Недопустимый путь в архиве репозитория');
      return !entry.name.endsWith('/');
    } });
    const manifests = Object.keys(files).filter((name) => /^[^/]+\/profile\.json$/.test(name));
    if (manifests.length !== 1) throw new Error('В корне репозитория нужны profile.json и styles.css');
    const prefix = manifests[0].slice(0, -'profile.json'.length);
    const selected = {};
    for (const [path, data] of Object.entries(files)) {
      if (!path.startsWith(prefix)) continue;
      const name = path.slice(prefix.length);
      if (/^(profile\.json|styles\.css|rules\.json|layout\.html|readme(?:\.(?:md|txt))?|license(?:\.(?:md|txt))?)$/i.test(name) || name.startsWith('assets/')) selected[name] = data;
    }
    const result = fflate.zipSync(selected, { level: 6 });
    profiles.payload(profiles.decodeArchive(result));
    return result;
  }

  async function download(value) {
    const { archiveUrl } = source(value);
    try {
      const response = await fetch(archiveUrl, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) });
      if (response.status === 404) throw new Error('Репозиторий или ветка не найдены. Нужен открытый репозиторий');
      if ([403, 429].includes(response.status)) throw new Error('GitHub ограничил загрузки. Попробуйте позже или добавьте ZIP');
      if (!response.ok) throw new Error(`GitHub не отдал архив (HTTP ${response.status})`);
      if (!['api.github.com', 'codeload.github.com'].includes(new URL(response.url).hostname)) throw new Error('Неожиданный адрес архива репозитория');
      return unpack(await readArchive(response));
    } catch (error) {
      if (error.name === 'TimeoutError') throw new Error('GitHub не ответил за 20 секунд. Попробуйте ещё раз');
      if (error instanceof TypeError) throw new Error('Не удалось скачать репозиторий. Проверьте подключение');
      throw error;
    }
  }

  globalThis.PageForgeRepositories = { origins, source, unpack, download, readArchive };
})();
