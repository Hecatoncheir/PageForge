(() => {
  if (globalThis.__pageForgeEngine) return;
  globalThis.__pageForgeEngine = true;
  const api = globalThis.browser ?? globalThis.chrome;
  let current = null;
  let root = null;
  let observer = null;
  let updateTimer;
  const allowedTags = new Set('A ARTICLE ASIDE B BLOCKQUOTE BR BUTTON CAPTION CODE COL COLGROUP DD DETAILS DIV DL DT EM FIGCAPTION FIGURE FOOTER H1 H2 H3 H4 H5 H6 HEADER HR I IMG LI MAIN NAV OL P PICTURE PRE SECTION SMALL SOURCE SPAN STRONG SUMMARY TABLE TBODY TD TH THEAD TIME TR U UL'.split(' '));

  function safeUrl(value, image = false) {
    if (value.startsWith('data:')) return image && /^data:image\//i.test(value) ? value : '';
    try {
      const url = new URL(value, location.href);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  const allowedAttributes = new Set('id class title alt href src role width height colspan rowspan datetime open type'.split(' '));

  function copyAttribute(target, attribute, assets) {
    const name = attribute.name.toLowerCase();
    if (!allowedAttributes.has(name) && !name.startsWith('aria-')) return;
    let value = attribute.value;
    if (name === 'src') value = assets[value] ?? safeUrl(value, true);
    if (name === 'href') value = safeUrl(value);
    target.setAttribute(name, value);
  }

  function copyNode(node, assets) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE || !allowedTags.has(node.tagName)) return null;
    const safe = document.createElement(node.tagName.toLowerCase());
    for (const attribute of node.attributes) copyAttribute(safe, attribute, assets);
    if (node.tagName === 'BUTTON') safe.setAttribute('type', 'button');
    if (node.tagName === 'A') safe.setAttribute('rel', 'noopener noreferrer');
    safe.append(...[...node.childNodes].map((child) => copyNode(child, assets)).filter(Boolean));
    return safe;
  }

  function clean(element, assets = {}) {
    // Исходные узлы остаются в инертном шаблоне, в страницу попадают только очищенные копии.
    element.replaceChildren(...[...element.childNodes].map((node) => copyNode(node, assets)).filter(Boolean));
    return element;
  }

  function sourceElement(selector) {
    return [...document.querySelectorAll(selector)].find((element) => !root?.contains(element));
  }

  function bind() {
    if (!root || !current) return;
    for (const binding of current.rules.bindings) {
      const source = sourceElement(binding.source);
      const targets = root.querySelectorAll(binding.target);
      if (!source) continue;
      for (const target of targets) bindTarget(binding.kind, source, target);
    }
  }

  function bindTarget(kind, source, target) {
    if (kind === 'text') {
      if (target.textContent !== source.textContent) target.textContent = source.textContent;
      return;
    }
    if (kind === 'html') return bindHtml(source, target);
    if (kind !== 'href' && kind !== 'src') return;
    const value = safeUrl(source.getAttribute(kind) ?? '', kind === 'src');
    if (target.getAttribute(kind) !== value) target.setAttribute(kind, value);
  }

  function bindHtml(source, target) {
    const copy = document.createElement('template');
    copy.content.append(...[...source.childNodes].map((node) => node.cloneNode(true)));
    clean(copy.content, current.assets);
    if (target.innerHTML !== copy.innerHTML) target.replaceChildren(copy.content);
  }

  function clear() {
    observer?.disconnect();
    observer = null;
    clearTimeout(updateTimer);
    root?.remove();
    root = null;
    current = null;
  }

  function apply(payload) {
    clear();
    current = payload;
    for (const selector of payload.rules.hide) document.querySelector(selector);
    if (payload.mode !== 'layout') return;
    for (const binding of payload.rules.bindings) {
      document.querySelector(binding.source);
      document.createElement('div').querySelector(binding.target);
    }
    const parsed = document.createElement('template');
    parsed.innerHTML = payload.template;
    clean(parsed.content, payload.assets);
    root = document.createElement('div');
    root.dataset.pageforgeRoot = '';
    root.className = 'pageforge-root';
    root.append(parsed.content);
    document.body.append(root);
    root.addEventListener('click', (event) => {
      for (const binding of current?.rules.bindings ?? []) {
        if (binding.kind !== 'click' || !event.target.closest(binding.target)) continue;
        event.preventDefault();
        sourceElement(binding.source)?.click();
        break;
      }
    });
    bind();
    observer = new MutationObserver((records) => {
      if (!records.some((record) => !root?.contains(record.target))) return;
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        if (root && !root.isConnected) document.body.append(root);
        bind();
      }, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  function snapshotBody() {
    const body = document.createElement('template');
    for (const node of document.body.childNodes) if (node !== root) body.content.append(node.cloneNode(true));
    clean(body.content);
    for (const node of body.content.querySelectorAll('[href], [src]')) stripParameters(node);
    return body;
  }

  function stripParameters(node) {
    for (const attribute of ['href', 'src']) {
      if (!node.hasAttribute(attribute)) continue;
      try {
        const url = new URL(node.getAttribute(attribute));
        url.search = ''; url.hash = '';
        node.setAttribute(attribute, url.href);
      } catch { node.removeAttribute(attribute); }
    }
  }

  function snapshotCss() {
    let css = '';
    for (const sheet of document.styleSheets) {
      try { for (const rule of sheet.cssRules) if (css.length < 1024 * 1024) css += `${rule.cssText}\n`; } catch { /* Чужие стили могут быть недоступны по правилам браузера. */ }
    }
    return css;
  }

  function snapshotComputed() {
    return [...document.querySelectorAll('body, main, article, h1, h2, p, a, button')].filter((element) => !root?.contains(element)).slice(0, 200).map((element) => {
      const style = getComputedStyle(element);
      return { tag: element.tagName.toLowerCase(), id: element.id, class: element.className, display: style.display, color: style.color, background: style.backgroundColor, font: style.font, margin: style.margin, padding: style.padding, width: style.width };
    });
  }

  function snapshot() {
    const body = snapshotBody();
    if (body.innerHTML.length > 2 * 1024 * 1024) throw new Error('Страница слишком большая для справочного снимка');
    const title = document.createElement('title');
    title.textContent = document.title;
    return { html: `<!doctype html><html lang="${document.documentElement.lang.replace(/[^a-z-]/gi, '') || 'ru'}"><head><meta charset="utf-8">${title.outerHTML}</head><body>${body.innerHTML}</body></html>`, css: snapshotCss(), computed: snapshotComputed() };
  }

  async function handle(message) {
    if (message.action === 'current') return current;
    if (message.action === 'clear') { clear(); return null; }
    if (message.action === 'apply') { apply(message.payload); return null; }
    if (message.action === 'snapshot') return snapshot();
    if (message.action === 'viewport') return { x: scrollX, y: scrollY };
    if (message.action === 'scroll') { scrollTo({ left: message.payload.x, top: message.payload.y, behavior: 'instant' }); return null; }
    if (message.action === 'ready') {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return true;
    }
    throw new Error('Неизвестная команда страницы');
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== api.runtime.id || message.type !== 'pageforge:engine') return false;
    handle(message).then((data) => sendResponse({ data }), (error) => sendResponse({ error: error.message }));
    return true;
  });
  void api.runtime.sendMessage({ type: 'pageforge:document-ready' }).catch(() => {});
})();
