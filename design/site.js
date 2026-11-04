const examples = [
  ['Бумага', '#fbf1c7', '#282828', '#d65d0e'],
  ['Полночь', '#1d2021', '#ebdbb2', '#fabd2f'],
  ['Фокус', '#f9f5d7', '#504945', '#79740e'],
  ['Терминал', '#282828', '#b8bb26', '#8ec07c'],
];
const grid = document.querySelector('.static-grid');
examples.forEach(([name, bg, ink, accent], index) => {
  const card = document.createElement('div');
  card.className = `static-card ${index === 0 ? 'active' : ''}`;
  card.innerHTML = `<div class="static-mini" style="--mini-bg:${bg};--mini-ink:${ink};--mini-accent:${accent}"><b>тише.</b><strong>Оставить<br>самое важное.</strong><i></i><div></div></div><div class="static-name">${name}<span>${index === 0 ? forge.icon('check') : ''}</span></div><div class="static-card-footer"><span class="mono">1.0.0</span>${forge.icon('download')}${forge.icon('trash')}</div>`;
  grid.append(card);
});
