const frame = document.querySelector('iframe');
const browser = document.querySelector('.demo-browser');
window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow) return;
  if (event.data?.type !== 'pageforge:appearance') return;
  const allowed = ['paper', 'night', 'focus', 'terminal', 'original'];
  browser.dataset.appearance = allowed.includes(event.data.appearance) ? event.data.appearance : 'paper';
  forge.animate(browser.querySelector('.journal'));
});
frame.addEventListener('load', () => {
  frame.contentWindow.postMessage({ type: 'pageforge:theme', theme: document.documentElement.dataset.theme }, location.origin === 'null' ? '*' : location.origin);
});
