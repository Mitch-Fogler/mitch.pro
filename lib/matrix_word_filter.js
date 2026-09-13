// Match words, not innocent substrings such as “class”, “Torres”, or “method”.
export const MATRIX_BLOCKED_TERMS = [
  'porn', 'pornography', 'hentai', 'nude', 'nudity', 'sex', 'nsfw', 'xxx',
  'cocaine', 'heroin', 'meth', 'marijuana', 'weed', 'fentanyl', 'lsd', 'ecstasy',
  'gun', 'firearm', 'bomb', 'explosive', 'knife', 'shooting', 'murder', 'gore',
  'suicide', 'self harm', 'cutting', 'casino', 'betting', 'sportsbook', 'poker',
  'hacking', 'exploit', 'malware', 'ransomware', 'ddos', 'phishing', 'keylogger',
  'proxy', 'vpn', 'unblock', 'unblocked games', 'bypass filter', 'tor',
  'roblox', 'fortnite', 'minecraft', 'steam', 'discord', 'tiktok', 'gaming', 'games',
  'torrent', 'pirate bay', 'cracked', 'warez', 'rom download',
  'anonymous chat', 'omegle', 'omegle style services', 'chatroom',
  'chatgpt', 'gemini', 'claude', 'ai chatbot', 'scramjet', 'ultraviolet',
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch',
  'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'faggot', 'nigger', 'nigga', 'retard',
];

function normalize(text) {
  return String(text).normalize('NFKC').toLowerCase()
    .replace(/[\p{Cf}\p{M}]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function decodeEntities(text) {
  return text.replace(/&#(x[\da-f]+|\d+);?/gi, (match, number) => {
    const code = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  }).replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (_, name) => ({
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  })[name.toLowerCase()]);
}

const needles = MATRIX_BLOCKED_TERMS.map(term => ' ' + normalize(term) + ' ');

export function matrixMessageBlocked(content) {
  if (!content || typeof content !== 'object') return false;
  const variants = [content, content['m.new_content']].filter(Boolean);
  for (const variant of variants) {
    const texts = [variant.body, variant.filename, variant.caption];
    if (typeof variant.formatted_body === 'string') {
      // Removing formatting catches split words such as pro<b>x</b>y.
      texts.push(decodeEntities(variant.formatted_body.replace(/<[^>]*>/g, '')));
      texts.push(decodeEntities(variant.formatted_body.replace(/<[^>]*>/g, ' ')));
    }
    for (const text of texts) {
      if (typeof text !== 'string') continue;
      const normalized = ' ' + normalize(text) + ' ';
      if (needles.some(needle => normalized.includes(needle))) return true;
    }
  }
  return false;
}
