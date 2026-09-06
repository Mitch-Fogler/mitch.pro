import { readFileSync } from 'node:fs';
for (const file of process.argv.slice(2)) {
  const html = readFileSync(file, 'utf8');
  let count = 0;
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    new Function(match[1]);
    count++;
  }
  console.log(`${file}: ${count} inline scripts parsed`);
}
