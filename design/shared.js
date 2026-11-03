(() => {
  const params = new URLSearchParams(location.search);
  const saved = localStorage.getItem('pageforge-design-theme');
  const theme = params.get('theme') ?? saved ?? 'dark';
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let toastTimer;
  window.forge = {
    icon(name, className = '') {
      return `<svg class="icon ${className}" aria-hidden="true"><use href="assets/icons.svg#${name}"></use></svg>`;
    },
    notify(message) {
      const toast = document.querySelector('.toast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
    },
    animate(element) {
      if (!reducedMotion.matches) element.animate([
        { opacity: .35, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    },
    download(name, data, type = 'application/zip') {
      const url = URL.createObjectURL(new Blob([data], { type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
  document.querySelectorAll('[data-icon]').forEach((element) => {
    element.innerHTML = forge.icon(element.dataset.icon);
  });
  function updateThemeButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      button.innerHTML = forge.icon(isDark ? 'sun' : 'moon');
      button.setAttribute('aria-label', isDark ? 'Светлая тема' : 'Тёмная тема');
    });
  }
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('pageforge-design-theme', theme);
      document.querySelector('iframe')?.contentWindow.postMessage({ type: 'pageforge:theme', theme }, location.origin === 'null' ? '*' : location.origin);
      updateThemeButtons();
    });
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.data?.type !== 'pageforge:theme') return;
    document.documentElement.dataset.theme = event.data.theme === 'light' ? 'light' : 'dark';
    updateThemeButtons();
  });
  updateThemeButtons();
})();
