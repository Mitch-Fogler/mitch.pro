import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.cwd();
const DATA_DIR = join(BASE, 'data');
const PASSWORDS_FILE = join(DATA_DIR, 'passwords.json');
const NEWSLETTER_EXTRA_FILE = join(DATA_DIR, 'newsletter_extra.json');
const NAMES_FILE = join(DATA_DIR, 'names.json');
const TOKENS_FILE = join(DATA_DIR, 'tokens.json');

const DEFAULT_PASS = 'dummyNewsletterPassword!!$';

function normalizeEmail(email) {
  if (!email) return '';
  let e = String(email).toLowerCase().trim();
  e = e.replace(/@student\.mitch\.pro$/i, '@student.rjuhsd.us');
  if (!e.includes('@')) return e;
  const at = e.lastIndexOf('@');
  const local = e.slice(0, at).split('+')[0].replace(/\./g, '');
  return local + '@' + e.slice(at + 1);
}

async function run() {
  const extra = JSON.parse(readFileSync(NEWSLETTER_EXTRA_FILE, 'utf8'));
  const passwords = JSON.parse(readFileSync(PASSWORDS_FILE, 'utf8'));
  const names = JSON.parse(readFileSync(NAMES_FILE, 'utf8'));
  const tokens = JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));

  let added = 0;
  for (const email of extra) {
    const norm = normalizeEmail(email);
    if (!passwords[norm]) {
      console.log(`Auto-enrolling ${email}...`);
      passwords[norm] = await Bun.password.hash(DEFAULT_PASS);
      
      // Also ensure they have a token if not present
      let hasToken = false;
      for (const t of Object.values(tokens)) {
        if (normalizeEmail(t.email || '') === norm) { hasToken = true; break; }
      }
      
      if (!hasToken) {
        const tok = crypto.randomUUID().replace(/-/g, '');
        tokens[tok] = {
          email: email,
          norm_email: norm,
          created_at: Date.now() / 1000,
          used: true,
          auto_enrolled: true
        };
      }
      
      added++;
    }
  }

  if (added > 0) {
    writeFileSync(PASSWORDS_FILE, JSON.stringify(passwords, null, 2));
    writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    console.log(`Successfully auto-enrolled ${added} newsletter subscribers.`);
  } else {
    console.log('No new newsletter subscribers to enroll.');
  }
}

run().catch(console.error);
