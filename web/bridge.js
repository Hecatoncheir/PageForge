(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  globalThis.pageForge = Object.freeze({
    async getContext() {
      if (!api?.runtime?.id) {
        return JSON.stringify({
          siteLabel: 'Предпросмотр интерфейса',
          version: 'dev',
        });
      }
      const result = await api.runtime.sendMessage({
        type: 'pageforge:get-context',
      });
      if (result.error) throw new Error(result.error);
      return JSON.stringify(result);
    },
  });
})();

