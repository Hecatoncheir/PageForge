local root = vim.fn.getcwd():gsub('\\', '/')
vim.opt.runtimepath:append(root .. '/work/complexity-tool')
vim.opt.runtimepath:append(root .. '/work/complexity')
require('cyclomatic.config').setup({ nested_functions = 'separate' })
local analyzer = require('cyclomatic.analyzer')
local threshold = 10
local entries, files = {}, {}
local scopes = {
  { 'lib/**/*.dart', 'dart' },
  { 'extension/*.js', 'javascript' },
  { 'web/bridge.js', 'javascript' },
  { 'web/repositories.js', 'javascript' },
}

local function analyze(file, language)
  local source = table.concat(vim.fn.readfile(file), '\n')
  local parser = vim.treesitter.get_string_parser(source, language)
  assert(not parser:parse()[1]:root():has_error(), 'Ошибка разбора: ' .. file)
  local result, err = analyzer.analyze_string(source, language)
  assert(result, err)
  files[#files + 1] = file
  for _, entry in ipairs(result.entries) do
    entries[#entries + 1] = {
      path = file, name = entry.name, line = entry.row + 1,
      cognitive = entry.cognitive, cyclomatic = entry.cyclomatic,
    }
  end
end

for _, scope in ipairs(scopes) do
  local matched = vim.fn.glob(scope[1], false, true)
  assert(#matched > 0, 'Не найдены исходные файлы: ' .. scope[1])
  for _, file in ipairs(matched) do
    file = file:gsub('\\', '/')
    -- Заимствованный виджет Flutter, см. docs/code-review.md.
    if file ~= 'lib/ui/widgets/cupertino/sliding_segmented_control.dart' then analyze(file, scope[2]) end
  end
end

assert(#entries > 0, 'Анализатор не нашёл функций')
table.sort(entries, function(a, b)
  if a.cognitive ~= b.cognitive then return a.cognitive > b.cognitive end
  if a.path ~= b.path then return a.path < b.path end
  return a.line < b.line
end)
table.sort(files)
local report = {
  threshold = threshold, nested_functions = 'separate', files = files,
  pins = vim.json.decode(table.concat(vim.fn.readfile('tools/complexity/pins.json'), '\n')),
  entries = entries,
}
vim.fn.writefile({ vim.json.encode(report) }, 'work/complexity-report.json')
print(string.format('Проверено файлов: %d, функций и замыканий: %d; максимум: %d (порог %d)', #files, #entries, entries[1].cognitive, threshold))
for index = 1, math.min(5, #entries) do
  local entry = entries[index]
  print(string.format('%s:%d %s — cognitive=%d, cyclomatic=%d', entry.path, entry.line, entry.name, entry.cognitive, entry.cyclomatic))
end
assert(entries[1].cognitive <= threshold, 'Превышен порог когнитивной сложности; см. work/complexity-report.json')
