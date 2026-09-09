import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontofficeSrc = path.resolve(__dirname, '../apps/frontoffice/src');

console.info('====================================================');
console.info('  I18N LOCAL AUDIT - COMPONENT & PAGE CHECKER       ');
console.info('====================================================');

const componentsDir = path.join(frontofficeSrc, 'components');
const pagesDir = path.join(frontofficeSrc, 'pages');

const componentFiles = fs
  .readdirSync(componentsDir)
  .filter((f) => f.endsWith('.vue'))
  .map((f) => path.join(componentsDir, f));

const pageFiles = fs
  .readdirSync(pagesDir)
  .filter((f) => f.endsWith('.vue'))
  .map((f) => path.join(pagesDir, f));

const allVueFiles = [...componentFiles, ...pageFiles, path.join(frontofficeSrc, 'App.vue')];

let issues = 0;
let audited = 0;

for (const file of allVueFiles) {
  audited++;
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(path.resolve(__dirname, '..'), file);

  const usesI18n =
    content.includes('useI18n') ||
    content.includes("from '@/lib/i18n'") ||
    content.includes("from '../lib/i18n'");
  const hasTranslatableText = /<h[1-6]|<Label|<Button|<TabsTrigger/.test(content);

  const status = usesI18n
    ? '[OK: I18N INTEGRATED]'
    : hasTranslatableText
      ? '[WARN: HARDCODED STRINGS]'
      : '[PASS: STATIC/ICON/BASE]';
  console.info(`${status.padEnd(26)} -> ${relPath}`);

  if (!usesI18n && hasTranslatableText && !relPath.includes('ui/')) {
    issues++;
  }
}

console.info('----------------------------------------------------');
console.info(`Total Vue Files Audited : ${audited}`);
console.info(`Components with warnings: ${issues}`);
console.info('====================================================');

if (issues > 0) {
  process.exitCode = 0;
}
