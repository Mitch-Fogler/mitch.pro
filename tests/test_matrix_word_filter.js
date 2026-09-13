import assert from 'node:assert/strict';
import { MATRIX_BLOCKED_TERMS, matrixMessageBlocked } from '../lib/matrix_word_filter.js';
for (const term of MATRIX_BLOCKED_TERMS) {
  assert(matrixMessageBlocked({ body: `Try ${term.toUpperCase()}!` }), term);
}
for (const body of ['Hello everyone', 'class assignment', 'Torres explained the method', 'a steamship', 'I need help and someone to talk to']) {
  assert.equal(matrixMessageBlocked({ body }), false, body);
}
assert(matrixMessageBlocked({ body: 'self-harm' }));
assert(matrixMessageBlocked({ body: 'ｓｃｒａｍｊｅｔ' }));
assert(matrixMessageBlocked({ body: 'ultra\u200bviolet' }));
assert(matrixMessageBlocked({ body: 'hello', 'm.new_content': { body: 'VPN' } }));
assert(matrixMessageBlocked({ body: 'hello', formatted_body: '<b>pro</b>xy' }));
assert(matrixMessageBlocked({ formatted_body: '&#112;roxy' }));
assert(matrixMessageBlocked({ body: 'photo', filename: 'nude.png' }));
console.log('Matrix policy: all terms, boundaries, edits, HTML, Unicode, and attachment names passed.');
