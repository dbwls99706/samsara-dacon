import fs from 'fs';
import path from 'path';
import sfx from '../src/data/sfx.json' with { type: 'json' };

const sfxKeys = Object.keys(sfx.sfx);

function walk(dir, files = []) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, files);
    else if (/\.(ts|json|html|mjs)$/.test(f)) files.push(fp);
  }
  return files;
}

const allFiles = walk('src');
const allText = allFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const orphan = [];
for (const k of sfxKeys) {
  const re = new RegExp(`['"\`]${esc(k)}['"\`]`, 'g');
  const matches = (allText.match(re) || []).length;
  // -1 for the sfx.json definition itself (one match always)
  if (matches <= 1) orphan.push({ key: k, refs: matches });
}

console.log('sfx total:', sfxKeys.length);
console.log('orphan (defined in sfx.json, never referenced in code):', orphan.length);
for (const o of orphan) console.log(' ', o.key, '(refs:', o.refs, ')');
process.exit(orphan.length === 0 ? 0 : 0); // informational only
