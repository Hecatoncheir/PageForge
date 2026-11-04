(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const prefix = 'data:application/zip;pageforge-name=';
  const validName = /^[a-z0-9._-]+\.zip$/i;

  // Chrome может повторно определить имя после downloads.download.
  // Имя в URL переживает перезапуск фонового обработчика и не требует хранения ZIP.
  api.downloads.onDeterminingFilename?.addListener((item, suggest) => {
    const match = /^data:application\/zip;pageforge-name=([^;,]+);base64,/.exec(item.url);
    if (item.byExtensionId !== api.runtime.id || !match || !validName.test(match[1])) {
      suggest();
      return;
    }
    suggest({ filename: match[1], conflictAction: 'uniquify' });
  });

  async function save(filename, archive) {
    if (!validName.test(filename)) throw new Error('Недопустимое имя ZIP');
    return api.downloads.download({
      url: `${prefix}${filename};base64,${archive}`,
      filename,
      conflictAction: 'uniquify',
      saveAs: false,
    });
  }

  globalThis.PageForgeDownloads = { save };
})();
