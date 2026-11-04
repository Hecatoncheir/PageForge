(() => {
  if (typeof importScripts === 'function') importScripts('vendor/fflate.js', 'profiles.js', 'store.js', 'runtime.js');
  const api = globalThis.browser ?? globalThis.chrome;
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== api.runtime.id) return false;
    if (message?.type === 'pageforge:document-ready' && sender.tab) {
      void PageForgeRuntime.documentReady(sender.tab.id).catch(() => {});
      return false;
    }
    if (message?.type !== 'pageforge:command' || sender.tab && !sender.url?.startsWith(api.runtime.getURL(''))) return false;
    PageForgeRuntime.handle(message.command, message.args).then(
      (data) => sendResponse({ data }),
      (error) => {
        console.warn(error.message);
        sendResponse({ error: /[а-яё]/i.test(error.message) ? error.message : 'Не удалось выполнить действие. Проверьте ZIP и правила оформления.' });
      },
    );
    return true;
  });
  void PageForgeRuntime.start().catch(console.warn);
})();

