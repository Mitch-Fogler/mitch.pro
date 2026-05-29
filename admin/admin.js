// Served only after password validation via /api/admin/js
(async function() {
  var PW = sessionStorage.getItem('apw') || '';
  var r = await fetch('/api/admin/data', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({pw: PW, type: 'content'})
  });
  if (!r.ok) { sessionStorage.removeItem('apw'); location.reload(); return; }
  var html = await r.text();
  document.open(); document.write(html); document.close();
})();
