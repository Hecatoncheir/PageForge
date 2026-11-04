(() => {
  let connection;
  function database() {
    connection ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('pageforge', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('profiles', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Не удалось открыть хранилище оформлений'));
    });
    return connection;
  }

  async function run(mode, operation) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', mode);
      const request = operation(transaction.objectStore('profiles'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(new Error('Не удалось сохранить оформление. Проверьте свободное место.'));
      transaction.onabort = transaction.onerror;
    });
  }
  globalThis.PageForgeStore = {
    all: () => run('readonly', (store) => store.getAll()),
    get: (id) => run('readonly', (store) => store.get(id)),
    put: (profile) => run('readwrite', (store) => store.put(profile)),
    remove: (id) => run('readwrite', (store) => store.delete(id)),
  };
})();
