(() => {
  const origins = ['https://api.github.com/*', 'https://codeload.github.com/*'];

  function repositoryUrl(value) {
    let url;
    try { url = new URL(value.trim()); } catch { throw new Error('Введите ссылку на открытый репозиторий GitHub'); }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) {
      throw new Error('Нужна ссылка вида https://github.com/owner/repo');
    }
    return url;
  }

  function repositoryIdentity(owner, originalName) {
    const name = originalName?.replace(/\.git$/, '');
    if (!/^[a-z\d][a-z\d-]{0,38}$/i.test(owner ?? '') || !/^[a-z\d_-][a-z\d._-]{0,99}$/i.test(name ?? '')) {
      throw new Error('Укажите репозиторий или ссылку на его ветку');
    }
    return { owner, name };
  }

  function repositoryReference(parts) {
    if (!parts.length) return 'HEAD';
    const [kind, ...reference] = parts;
    const releaseLink = kind === 'releases' && reference[0] === 'tag' && reference.length > 1;
    if (!releaseLink && (!['tree', 'commit'].includes(kind) || !reference.length)) {
      throw new Error('Укажите репозиторий или ссылку на его ветку');
    }
    let ref;
    try { ref = decodeURIComponent((releaseLink ? reference.slice(1) : reference).join('/')); } catch { throw new Error('Некорректная ссылка на ветку'); }
    if (!ref || ref.length > 200 || /[\s\\\x00-\x1f]/.test(ref)) throw new Error('Некорректная ссылка на ветку');
    return ref;
  }

  function source(value) {
    const parts = repositoryUrl(value).pathname.replace(/\/+$/, '').split('/').slice(1);
    const { owner, name } = repositoryIdentity(...parts);
    const ref = repositoryReference(parts.slice(2));
    return { owner, name, repositoryUrl: `https://github.com/${owner}/${name}`, archiveUrl: `https://api.github.com/repos/${owner}/${name}/zipball/${encodeURIComponent(ref)}` };
  }

  async function readArchive(response, limit = PageForgeProfiles.LIMITS.archive) {
    const message = limit === PageForgeProfiles.LIMITS.archive ? 'Архив репозитория должен быть не больше 8 МБ' : 'Ответ GitHub слишком большой';
    if (Number(response.headers.get('content-length')) > limit) {
      await response.body?.cancel();
      throw new Error(message);
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) throw new Error(message);
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

  async function request(url) {
    try {
      const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) });
      if (response.status === 404) throw new Error('Репозиторий или ветка не найдены. Нужен открытый репозиторий');
      if ([403, 429].includes(response.status)) throw new Error('GitHub ограничил загрузки. Попробуйте позже или добавьте ZIP');
      if (!response.ok) throw new Error(`GitHub не отдал архив (HTTP ${response.status})`);
      const address = new URL(response.url);
      if (address.protocol !== 'https:' || !['api.github.com', 'codeload.github.com'].includes(address.hostname)) throw new Error('Неожиданный адрес ответа GitHub');
      return response;
    } catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error.name)) throw new Error('GitHub не ответил за 20 секунд. Попробуйте ещё раз');
      if (error instanceof TypeError) throw new Error('Не удалось скачать репозиторий. Проверьте подключение');
      throw error;
    }
  }

  async function download(value) {
    return unpack(await readArchive(await request(source(value).archiveUrl)));
  }

  function versionParts(value) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value ?? '');
    const parts = match?.slice(1).map(Number);
    return parts?.every(Number.isSafeInteger) ? parts : null;
  }

  function newer(candidate, current) {
    const next = versionParts(candidate);
    const installed = versionParts(current);
    if (!next || !installed) return false;
    for (let index = 0; index < 3; index++) {
      if (next[index] !== installed[index]) return next[index] > installed[index];
    }
    return false;
  }

  async function latestRelease(value, extension = false) {
    const { owner, name, repositoryUrl } = source(value);
    const response = await request(`https://api.github.com/repos/${owner}/${name}/releases?per_page=20`);
    let releases;
    try { releases = JSON.parse(new TextDecoder().decode(await readArchive(response, 1024 * 1024))); }
    catch { throw new Error('Не удалось прочитать список релизов GitHub'); }
    if (!Array.isArray(releases)) throw new Error('Некорректный список релизов GitHub');
    const available = releases.filter((release) => !release.draft && release.published_at && versionParts(release.tag_name))
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
    const latest = available.find((release) => !extension || ['chrome', 'firefox'].every((browser) => release.assets?.some((asset) => asset.name === `pageforge-${browser}-${release.tag_name.replace(/^v/, '')}.zip` && asset.state === 'uploaded')));
    if (!latest) return null;
    return { version: latest.tag_name.replace(/^v/, ''), url: `${repositoryUrl}/releases/tag/${encodeURIComponent(latest.tag_name)}` };
  }

  globalThis.PageForgeRepositories = { origins, source, unpack, download, readArchive, newer, latestRelease };
})();
