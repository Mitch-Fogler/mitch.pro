import { readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const WEBROOT = join(process.cwd(), 'webserver');
const GAMES_FILE_LOCAL = join(process.cwd(), 'games_local');
const CATS_FILE_LOCAL = join(process.cwd(), 'data', 'game_categories_local.json');

function formatTitle(name) {
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function scanDir(basePath, prefix, category) {
  const fullPath = join(WEBROOT, basePath);
  if (!existsSync(fullPath)) return { games: [], cats: {} };

  const entries = readdirSync(fullPath, { withFileTypes: true });
  const games = [];
  const cats = {};

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Check if it's a game folder (has index.html)
      if (existsSync(join(fullPath, entry.name, 'index.html'))) {
        const href = `${prefix}${entry.name}/`;
        const title = formatTitle(entry.name);
        games.push(`url ${href} ${title}`);
        cats[href] = category;
      }
    }
  }
  return { games, cats };
}

const p3kh0 = scanDir('games/3kh0', '3kh0/', '3kh0');
const pGfiles = scanDir('games/gfiles/gfiles/html5', 'gfiles/gfiles/html5/', 'gfiles');

const allGames = [...p3kh0.games, ...pGfiles.games];
const allCats = { ...p3kh0.cats, ...pGfiles.cats };

if (allGames.length > 0) {
  writeFileSync(GAMES_FILE_LOCAL, allGames.join('\n'));
  writeFileSync(CATS_FILE_LOCAL, JSON.stringify(allCats, null, 2));
  console.log(`Scanned ${allGames.length} local games (3kh0: ${p3kh0.games.length}, gfiles: ${pGfiles.games.length})`);
  console.log(`Saved entries to ${GAMES_FILE_LOCAL}`);
  console.log(`Saved categories to ${CATS_FILE_LOCAL}`);
}
