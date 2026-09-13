export function planOwnerAction({ owner, actor, action, emails, confirmation, passwords, coins, protectedEmail }) {
  if (!owner) throw Object.assign(new Error('Owner access required.'), { status: 403 });
  if (action === 'reset-coins') {
    if (confirmation !== 'RESET ALL COINS') throw Object.assign(new Error('Type RESET ALL COINS to confirm.'), { status: 400 });
    return { action, targets: Object.keys(coins), nextCoins: Object.fromEntries(Object.keys(coins).map(email => [email, 0])) };
  }
  if (action !== 'remove-registrations' || !Array.isArray(emails) || !emails.length || emails.length > 10000 || emails.some(e => typeof e !== 'string')) {
    throw Object.assign(new Error('Choose registered accounts to remove.'), { status: 400 });
  }
  const targets = [...new Set(emails)];
  if (targets.some(email => email === actor || protectedEmail(email))) throw Object.assign(new Error('Owner accounts cannot be removed here.'), { status: 403 });
  if (targets.some(email => !Object.hasOwn(passwords, email))) throw Object.assign(new Error('The account list changed. Reload it before continuing.'), { status: 409 });
  if (confirmation !== `REMOVE ${targets.length} REGISTRATIONS`) throw Object.assign(new Error(`Type REMOVE ${targets.length} REGISTRATIONS to confirm.`), { status: 400 });
  return { action, targets };
}
