(() => {
  const api = globalThis.browser ?? globalThis.chrome;

  async function readContext() {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    let siteLabel = 'Откройте обычную веб-страницу';
    if (tab?.url && /^https?:\/\//.test(tab.url)) {
      siteLabel = new URL(tab.url).hostname;
    }
    return { siteLabel, version: api.runtime.getManifest().version };
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== api.runtime.id) return false;
    if (message?.type !== 'pageforge:get-context') return false;
    readContext().then(sendResponse, () => {
      sendResponse({ error: 'Не удалось получить сведения о вкладке' });
    });
    return true;
  });
})();

