import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'articles/data/articles.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const published = registry.articles.filter(a => a.status === 'published');

const checks = [
  ['title', a => a.title && a.title.length >= 30 && a.title.length <= 65],
  ['description', a => a.description && a.description.length >= 70 && a.description.length <= 165],
  ['slug', a => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug || '')],
  ['canonical URL', a => a.url === `/articles/${a.slug}/`],
  ['category', a => /^[a-z0-9-]+$/.test(a.category || '')],
  ['tags', a => Array.isArray(a.tags) && a.tags.length >= 2],
  ['author', a => Boolean(a.author)],
  ['publishedAt', a => /^\d{4}-\d{2}-\d{2}$/.test(a.publishedAt || '')],
  ['updatedAt', a => /^\d{4}-\d{2}-\d{2}$/.test(a.updatedAt || '')],
  ['readingTime', a => Number.isInteger(a.readingTime) && a.readingTime > 0],
];

let failed = 0;
for (const article of published) {
  const failures = checks.filter(([, test]) => !test(article)).map(([name]) => name);
  const score = Math.round(((checks.length - failures.length) / checks.length) * 100);
  console.log(`${score >= 90 ? 'PASS' : score >= 70 ? 'WARN' : 'FAIL'} ${article.slug}: ${score}/100`);
  if (failures.length) console.log(`  Missing/invalid: ${failures.join(', ')}`);
  if (score < 90) failed++;
}

console.log(`\nChecked ${published.length} published article(s).`);
if (failed) process.exitCode = 1;
