import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { configureDataStore, readDocument, writeDocument } from '../lib/data_store.js';

const BASE = process.cwd();
const DATA_DIR = join(BASE, 'data');
configureDataStore({ baseDir: BASE, dataDir: DATA_DIR });
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
  const extra = readDocument(NEWSLETTER_EXTRA_FILE, []);
  const passwords = readDocument(PASSWORDS_FILE, {});
  const names = readDocument(NAMES_FILE, {});
  const tokens = readDocument(TOKENS_FILE, {});

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
    writeDocument(PASSWORDS_FILE, passwords);
    writeDocument(TOKENS_FILE, tokens);
    console.log(`Successfully auto-enrolled ${added} newsletter subscribers.`);
  } else {
    console.log('No new newsletter subscribers to enroll.');
  }
}

run().catch(console.error);
