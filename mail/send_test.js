#!/usr/bin/env bun
// Usage: bun run mail/send_test.js
import path from 'path';
import fs from 'fs';
const nodemailer = require('nodemailer');

// Load environment variables
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
} catch(e) {}

// Fallback to Doppler if needed
function loadDopplerEnv() {
  if (process.env.GMAIL_USER) return;
  try {
    const raw = require('child_process').execSync('doppler secrets download --format json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const secrets = JSON.parse(raw);
    for (const [k, v] of Object.entries(secrets)) {
      if (!process.env[k]) process.env[k] = String(v);
    }
  } catch(e) {}
}
loadDopplerEnv();

const GMAIL_USER = (process.env.GMAIL_USER || '').trim().replace(/^["']|["']$/g, '');
const GMAIL_PASS = (process.env.GMAIL_PASS || '').trim().replace(/^["']|["']$/g, '');

if (!GMAIL_USER || !GMAIL_PASS) {
  console.error("Error: GMAIL_USER and GMAIL_PASS environment variables are not set.");
  process.exit(1);
}

// Unsubscribe token helpers
let _site = { primary: 'https://mitch.pro', alternate: 'https://mitchdog.com' };
try {
  _site = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'site.json'), 'utf8'));
} catch(e) {}
const PRIMARY = _site.primary.replace(/\/$/, '');
const ALT     = _site.alternate.replace(/\/$/, '');

function formatHtmlEmail(subject, textBody, unsubscribeUrl, primaryUrl, altUrl) {
  if (textBody.trim().startsWith('<') || /<[a-z][\s\S]*>/i.test(textBody)) {
    return textBody;
  }

  const escapedText = textBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const paragraphs = escapedText.split(/\n\n+/).map(p => {
    return `<p style="margin: 0 0 16px; line-height: 1.6;">${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  const footerHtml = `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
      <p style="margin: 0 0 8px;">
        This is an automated system check email. <br>
        Also accessible at <a href="${altUrl || 'https://mitchdog.com'}" style="color: #64748b; text-decoration: underline;">mitchdog.com</a>
      </p>
      <p style="margin: 0;">
        For support: email SUPPORT to <a href="mailto:support@mitch.pro" style="color: #64748b; text-decoration: none;">support@mitch.pro</a>
      </p>
      <p style="margin: 8px 0 0;">
        2014 Capitol Ave #100, Sacramento, CA 95811
      </p>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06060c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #06060c; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <tr>
            <td height="6" style="background: linear-gradient(to right, #a855f7, #38bdf8);"></td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 16px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.03em; color: #f8fafc; background: linear-gradient(to right, #c084fc, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">mitch.pro</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
              ${paragraphs}
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

const subject = "mitch.pro - Automated System Mail Test";
const rawBody = `Hello!

This is a beautiful test email sent via Gmail SMTP to verify that the automated system and credentials are functioning correctly.

Here are the details of this test execution:
- Destination (GMAIL_USER): ${GMAIL_USER}
- Mailer Engine: Nodemailer SMTP
- Timestamp: ${new Date().toLocaleString()}

Have a wonderful day!`;

const bodyText = rawBody + `\n\n---\nAlso available at ${ALT}\nFor support: email SUPPORT to support@mitch.pro\n2014 Capitol Ave #100, Sacramento, CA 95811`;
const htmlBody = formatHtmlEmail(subject, rawBody, null, PRIMARY, ALT);

console.log(`Sending test email from ${GMAIL_USER} to ${GMAIL_USER} via Gmail SMTP...`);

(async () => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });

  await transporter.sendMail({
    from: `mitch.pro <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject,
    text: bodyText,
    html: htmlBody,
    priority: 'high'
  });

  console.log(`Test email sent successfully to ${GMAIL_USER}`);
})().catch(e => {
  console.error("Failed to send test email:", e.message);
  process.exit(1);
});
