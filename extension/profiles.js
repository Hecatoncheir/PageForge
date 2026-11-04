(() => {
  const text = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const bytes = (value) => new TextEncoder().encode(value);
  const LIMITS = { archive: 8 * 1024 * 1024, expanded: 16 * 1024 * 1024, files: 128, profiles: 50, storage: 64 * 1024 * 1024 };

  function requireValue(condition, message) {
    if (!condition) throw new Error(message);
  }

  function safePath(value) {
    return typeof value === 'string' && value.length <= 240
      && !value.startsWith('/') && !value.includes('\\') && !value.includes(':')
      && !value.split('/').some((part) => part === '..' || part === '.')
      && !/[\x00-\x1f]/.test(value);
  }

  function parsePattern(pattern) {
    requireValue(typeof pattern === 'string' && pattern.length <= 2000, 'Неверное правило адреса');
    const match = /^(https?|\*):\/\/((?:\*\.)?[a-z\d.-]+|\[[a-f\d:]+\])(\/[^#]*)$/i.exec(pattern);
    requireValue(match && !/[\s\\]/.test(pattern), 'Адрес должен иметь вид https://example.com/*');
    return { protocol: match[1], host: match[2].toLowerCase(), path: match[3] };
  }

  function matches(patterns, address) {
    try {
      const url = new URL(address);
      if (!['http:', 'https:'].includes(url.protocol)) return false;
      return patterns.some((value) => {
        const pattern = parsePattern(value);
        if (pattern.protocol !== '*' && `${pattern.protocol}:` !== url.protocol) return false;
        const suffix = pattern.host.slice(2);
        const hostMatches = pattern.host.startsWith('*.')
          ? url.hostname === suffix || url.hostname.endsWith(`.${suffix}`)
          : url.hostname === pattern.host;
        const escaped = pattern.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
        return hostMatches && new RegExp(`^${escaped}$`).test(url.pathname);
      });
    } catch { return false; }
  }

  function validateManifest(value) {
    requireValue(value && value.schemaVersion === 1, 'Неподдерживаемая версия формата ZIP');
    requireValue(typeof value.id === 'string' && /^[a-z\d_-]{1,80}$/i.test(value.id), 'Идентификатор: до 80 букв, цифр, дефисов и подчёркиваний');
    requireValue(typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 80, 'Нужно название длиной до 80 символов');
    requireValue(typeof value.version === 'string' && /^\d+\.\d+\.\d+$/.test(value.version), 'Версия оформления должна иметь вид 1.0.0');
    requireValue(['css', 'layout'].includes(value.mode), 'Режим должен быть css или layout');
    requireValue(Array.isArray(value.matches) && value.matches.length > 0 && value.matches.length <= 20, 'Укажите от 1 до 20 правил адресов');
    value.matches.forEach(parsePattern);
    return { schemaVersion: 1, id: value.id, name: value.name.trim(), version: value.version, mode: value.mode, matches: value.matches };
  }

  function validateRules(value = {}) {
    const hide = value.hide ?? [];
    const bindings = value.bindings ?? [];
    requireValue(Array.isArray(hide) && hide.length <= 100, 'Не более 100 правил скрытия');
    hide.forEach((selector) => requireValue(typeof selector === 'string' && selector.length <= 500 && !/[{}]/.test(selector), 'Неверный селектор скрытия'));
    requireValue(Array.isArray(bindings) && bindings.length <= 100, 'Не более 100 привязок');
    for (const binding of bindings) {
      requireValue(['text', 'html', 'href', 'src', 'click'].includes(binding.kind), 'Неизвестный тип привязки');
      requireValue(['source', 'target'].every((key) => typeof binding[key] === 'string' && binding[key].length > 0 && binding[key].length <= 500), 'У привязки нужны source и target');
    }
    return { hide, bindings };
  }

  function decodeArchive(encoded) {
    const archive = typeof encoded === 'string' ? fromBase64(encoded) : encoded;
    requireValue(archive.length <= LIMITS.archive, 'Размер ZIP — до 8 МБ');
    let size = 0;
    let count = 0;
    const files = fflate.unzipSync(archive, { filter(entry) {
      count += 1;
      size += entry.originalSize;
      requireValue(count <= LIMITS.files && size <= LIMITS.expanded, 'В ZIP слишком много данных');
      requireValue(safePath(entry.name), 'Недопустимый путь внутри ZIP');
      requireValue(!/\.(?:[cm]?js|wasm|exe|dll|bat|ps1)$/i.test(entry.name), 'Исполняемые файлы в оформлении не поддерживаются');
      return !entry.name.endsWith('/');
    } });
    requireValue(files['profile.json'] && files['styles.css'], 'В корне ZIP нужны profile.json и styles.css');
    const manifest = validateManifest(JSON.parse(text(files['profile.json'])));
    const rules = validateRules(files['rules.json'] ? JSON.parse(text(files['rules.json'])) : {});
    const css = text(files['styles.css']);
    requireValue(css.length <= 1024 * 1024, 'styles.css должен быть не больше 1 МБ');
    if (manifest.mode === 'layout') requireValue(files['layout.html'], 'Для режима layout нужен layout.html');
    const template = files['layout.html'] ? text(files['layout.html']) : '';
    requireValue(template.length <= 512 * 1024, 'Шаблон слишком большой');
    return { ...manifest, rules, css, template, files, size, preview: null, previewState: 'pending', updatedAt: Date.now() };
  }

  function toBase64(value) {
    let result = '';
    for (let index = 0; index < value.length; index += 8192) result += String.fromCharCode(...value.subarray(index, index + 8192));
    return btoa(result);
  }

  function fromBase64(value) {
    requireValue(typeof value === 'string' && value.length <= Math.ceil(LIMITS.archive * 4 / 3) + 4, 'Архив слишком большой');
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  function mime(name) {
    const extension = name.split('.').pop().toLowerCase();
    return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' }[extension] ?? 'application/octet-stream';
  }

  function resource(profile, name) {
    requireValue(safePath(name) && name.startsWith('assets/') && profile.files[name], `Ресурс не найден: ${name}`);
    return `data:${mime(name)};base64,${toBase64(profile.files[name])}`;
  }

  function payload(profile) {
    const decodedCss = profile.css.replace(/\\([a-f\d]{1,6})\s?/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/\\([^\r\n])/g, '$1');
    requireValue(!/@import\b/i.test(decodedCss), 'Добавляйте CSS и шрифты в ZIP; @import не поддерживается');
    const references = [...decodedCss.matchAll(/url\(\s*(?:["']([^"']*)["']|([^)]*))\s*\)/gi)];
    for (const reference of references) {
      const name = (reference[1] ?? reference[2]).trim();
      requireValue(name.startsWith('#') || name.startsWith('assets/'), 'В CSS разрешены только ресурсы assets/ и ссылки #id');
    }
    const css = profile.css.replace(/url\(\s*(?:["']([^"']*)["']|([^)]*))\s*\)/gi, (_, quoted, plain) => {
      const name = (quoted ?? plain).trim();
      return name.startsWith('#') ? `url("${name}")` : `url("${resource(profile, name)}")`;
    });
    const hideCss = profile.rules.hide.map((selector) => `${selector} { display: none !important; }`).join('\n');
    const layoutCss = profile.mode === 'layout' ? '\nbody:has(> [data-pageforge-root]) > :not([data-pageforge-root]) { display: none !important; }' : '';
    const assets = {};
    for (const name of Object.keys(profile.files)) if (name.startsWith('assets/')) assets[name] = resource(profile, name);
    return { id: profile.id, mode: profile.mode, css: `${css}\n${hideCss}${layoutCss}`, template: profile.template, rules: profile.rules, assets };
  }

  function encodeArchive(profile) {
    const files = { ...profile.files };
    const originalManifest = files['profile.json'] ? JSON.parse(text(files['profile.json'])) : {};
    const originalRules = files['rules.json'] ? JSON.parse(text(files['rules.json'])) : {};
    files['profile.json'] = bytes(JSON.stringify({ ...originalManifest, ...validateManifest(profile) }, null, 2) + '\n');
    files['styles.css'] = bytes(profile.css);
    files['rules.json'] = bytes(JSON.stringify({ ...originalRules, ...profile.rules }, null, 2) + '\n');
    return fflate.zipSync(files, { level: 6 });
  }

  function starter(address, snapshot) {
    const url = new URL(address);
    const manifest = { schemaVersion: 1, id: crypto.randomUUID(), name: `Мой ${url.hostname}`, version: '1.0.0', mode: 'css', matches: [`${url.protocol}//${url.hostname}/*`] };
    const files = {
      'profile.json': bytes(JSON.stringify(manifest, null, 2)),
      'styles.css': bytes('/* Оформление сайта. Ресурсы размещайте в assets/. */\nbody {\n  /* background: #fbf1c7; color: #282828; */\n}\n'),
      'rules.json': bytes(JSON.stringify({ hide: [], bindings: [] }, null, 2)),
      'layout.html': bytes('<main class="pageforge-layout"><h1 id="title"></h1><article id="content"></article></main>\n'),
      'reference/page.html': bytes(snapshot.html),
      'reference/styles.css': bytes(snapshot.css),
      'reference/computed.json': bytes(JSON.stringify(snapshot.computed, null, 2)),
      'README.txt': bytes('Измените name и id в profile.json, затем styles.css. Импортируйте ZIP обратно в PageForge.\nРежим css сохраняет исходные элементы и действия сайта.\nДля собственной разметки переключите mode на layout и настройте bindings в rules.json.\nreference — справочный снимок текущей страницы, а не исходный проект сайта.\n'),
    };
    return { ...manifest, rules: { hide: [], bindings: [] }, css: text(files['styles.css']), template: text(files['layout.html']), files };
  }

  globalThis.PageForgeProfiles = { LIMITS, safePath, parsePattern, matches, validateManifest, validateRules, decodeArchive, encodeArchive, payload, starter, toBase64, fromBase64 };
})();
