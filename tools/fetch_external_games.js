import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const GAMES_FILE = join(process.cwd(), 'games_external');
const CATS_FILE = join(process.cwd(), 'data', 'game_categories_external.json');

// High-capacity endpoint discovered to support 25,000+ games in one request
const RSS_FEED_URL = 'https://gamemonetize.com/rssfeed.php?format=json&category=All&amount=25000';

async function fetchMassiveLibrary() {
  console.log('Fetching massive GameMonetize catalog (20,000+ games)...');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json'
  };

  try {
    const res = await fetch(RSS_FEED_URL, { headers });
    const text = await res.text();
    
    if (text.includes('error code: 1015')) {
      console.error('!! Rate limited by Cloudflare. Try again in 30 minutes.');
      return null;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('!! JSON Parse Error. The feed might be too large or blocked.');
      return null;
    }
    
    if (!Array.isArray(data)) return { games: [], cats: {} };

    const games = [];
    const cats = {};
    const seen = new Set();

    data.forEach(game => {
      if (!game.url || seen.has(game.url)) return;
      seen.add(game.url);
      
      // RSS format uses .url and .title
      games.push(`iframe ${game.url} ${game.title}`);
      
      // Standardize categories
      let cat = (game.category || 'other').toLowerCase();
      // Remove trailing 's' from categories like "Puzzles" -> "puzzle"
      if (cat.endsWith('s') && cat !== 'girls') cat = cat.slice(0, -1);
      cats[game.url] = cat;
    });

    return { games, cats };
  } catch (e) {
    console.error('!! Network error:', e.message);
    return null;
  }
}

async function run() {
  const res = await fetchMassiveLibrary();
  
  if (res && res.games.length > 0) {
    // Overwrite with the master list to keep it clean and deduplicated
    writeFileSync(GAMES_FILE, res.games.join('\n'));
    writeFileSync(CATS_FILE, JSON.stringify(res.cats, null, 2));
    
    console.log(`\nSUCCESS: Library complete.`);
    console.log(`Total Unique Games in External File: ${res.games.length}`);
    console.log(`Saved to ${GAMES_FILE}`);
  } else {
    console.error('\nERROR: Failed to fetch the massive library.');
  }
}

run();
