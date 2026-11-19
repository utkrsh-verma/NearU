import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { app, registerSocket, unregisterSocket } from './src/app.ts';
import { supabaseAdmin } from './src/lib/supabase-admin.ts';
import { getProfileRow } from './src/db/queries.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const server = http.createServer(app);

  // Real-time WebSocket server attached to HTTP server
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let authenticatedUid: string | null = null;

    const authTimeout = setTimeout(() => {
      if (!authenticatedUid && ws.readyState === WebSocket.OPEN) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 10000);

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'auth' && typeof msg.token === 'string') {
          const {
            data: { user },
            error,
          } = await supabaseAdmin.auth.getUser(msg.token);
          if (error || !user) {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Authentication failed' }));
            ws.close(4001, 'Authentication failed');
            return;
          }
          const row = await getProfileRow(user.id);
          if (!row || !row.isVerified || !row.isProfileComplete || !row.isActive) {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Profile ineligible' }));
            ws.close(4003, 'Profile ineligible');
            return;
          }
          if (authenticatedUid) {
            unregisterSocket(authenticatedUid, ws);
          }
          authenticatedUid = user.id;
          clearTimeout(authTimeout);
          registerSocket(authenticatedUid, ws);
          ws.send(JSON.stringify({ type: 'auth:ok', uid: authenticatedUid }));
        } else if (msg?.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        ws.send(JSON.stringify({ type: 'auth:error', error: 'Invalid token' }));
        ws.close(4003, 'Unauthorized');
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (authenticatedUid) {
        unregisterSocket(authenticatedUid, ws);
      }
    });
  });

  // Mount Vite middleware in development or static dist in production
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`NearU server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NearU server:', err);
  process.exit(1);
});
