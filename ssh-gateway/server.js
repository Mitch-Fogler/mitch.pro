import { WebSocketServer } from 'ws';
import { Client as SSHClient } from 'ssh2';

const PORT = Number(process.env.PORT || 6820);

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

function send(ws, obj) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(obj));
  }
}

function clearSecrets(obj) {
  if (!obj || typeof obj !== 'object') return;
  if ('password' in obj) obj.password = null;
  if ('privateKey' in obj) obj.privateKey = null;
  if ('passphrase' in obj) obj.passphrase = null;
}

function cleanupSession(session) {
  if (!session) return;
  try {
    if (session.stream) session.stream.end();
  } catch (_) {}
  try {
    if (session.conn) session.conn.end();
  } catch (_) {}
  session.stream = null;
  session.conn = null;
}

wss.on('connection', (ws) => {
  const session = { conn: null, stream: null };

  ws.on('message', (raw) => {
    let payload;
    try {
      payload = JSON.parse(String(raw));
    } catch (_) {
      send(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    if (!payload || typeof payload.type !== 'string') {
      send(ws, { type: 'error', message: 'Missing message type' });
      return;
    }

    if (payload.type === 'connect') {
      if (session.conn) {
        send(ws, { type: 'error', message: 'Already connected' });
        return;
      }

      const host = String(payload.host || '').trim();
      const port = Number(payload.port) || 22;
      const username = String(payload.username || '').trim();
      const cols = Number(payload.cols) || 80;
      const rows = Number(payload.rows) || 24;

      if (!host || !username) {
        send(ws, { type: 'error', message: 'host and username are required' });
        return;
      }

      console.log(`[ssh-gateway] connect ${username}@${host}:${port}`);

      const connectOpts = {
        host,
        port,
        username,
      };

      if (payload.privateKey) {
        connectOpts.privateKey = payload.privateKey;
        if (payload.passphrase) {
          connectOpts.passphrase = payload.passphrase;
        }
      } else if (payload.password) {
        connectOpts.password = payload.password;
      }

      // Clear secrets from the inbound payload and connect opts references after build
      clearSecrets(payload);
      const optsForConnect = { ...connectOpts };
      clearSecrets(connectOpts);

      const conn = new SSHClient();
      session.conn = conn;

      conn.on('ready', () => {
        conn.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
          if (err) {
            send(ws, { type: 'error', message: 'Failed to open shell: ' + err.message });
            cleanupSession(session);
            ws.close();
            return;
          }
          session.stream = stream;
          send(ws, { type: 'connected' });

          stream.on('data', (data) => {
            send(ws, { type: 'data', data: data.toString('utf-8') });
          });

          stream.on('close', () => {
            cleanupSession(session);
            ws.close();
          });
        });
      });

      conn.on('error', (err) => {
        send(ws, { type: 'error', message: err.message });
        cleanupSession(session);
        ws.close();
      });

      conn.on('close', () => {
        cleanupSession(session);
        if (ws.readyState === 1) ws.close();
      });

      conn.connect(optsForConnect);
      clearSecrets(optsForConnect);
      return;
    }

    if (payload.type === 'data') {
      if (session.stream && typeof payload.data === 'string') {
        session.stream.write(payload.data);
      }
      return;
    }

    if (payload.type === 'resize') {
      if (session.stream) {
        const rows = Number(payload.rows) || 24;
        const cols = Number(payload.cols) || 80;
        session.stream.setWindow(rows, cols, 0, 0);
      }
      return;
    }
  });

  ws.on('close', () => {
    cleanupSession(session);
  });

  ws.on('error', () => {
    cleanupSession(session);
  });
});

console.log(`[ssh-gateway] listening on 0.0.0.0:${PORT}`);
