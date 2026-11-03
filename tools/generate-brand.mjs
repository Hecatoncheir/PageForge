import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'design/assets');
const variants = [['forge', 'logo.svg'], ['fold', 'logo-fold.svg'], ['stamp', 'logo-stamp.svg']];
const symbols = variants.map(([id, file]) => {
  const svg = readFileSync(path.join(assets, file), 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const content = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<symbol id="${id}" viewBox="${viewBox}">${content}</symbol>`;
});
writeFileSync(path.join(assets, 'marks.svg'), `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`);
const logo = readFileSync(path.join(assets, 'logo.svg'), 'utf8');
const content = logo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replaceAll('currentColor', '#fe8019');
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="29" fill="#282828"/><g transform="translate(16 8)">${content}</g></svg>`;
mkdirSync(path.join(root, 'extension/icons'), { recursive: true });
for (const width of [16, 32, 48, 128]) {
  const png = new Resvg(square, { fitTo: { mode: 'width', value: width } }).render().asPng();
  writeFileSync(path.join(root, `extension/icons/icon-${width}.png`), png);
}
for (const [name, color] of [['orange', '#fe8019'], ['ink', '#282828'], ['cream', '#fbf1c7']]) {
  const svg = logo.replaceAll('currentColor', color);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
  writeFileSync(path.join(assets, `logo-${name}.png`), png);
}
writeFileSync(path.join(assets, 'app-icon.svg'), square);
console.log('Подготовлены SVG-символы, PNG логотипа и значки расширения.');
