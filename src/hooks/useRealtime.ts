import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChatMessage, MatchSummary } from '../types/nearu';

export interface RealtimeHandlers {
  onMessageCreated?: (matchId: number, message: ChatMessage) => void;
  onMessagesRead?: (matchId: number, readerId: string, readAt: string) => void;
  onMatchCreated?: (match: MatchSummary) => void;
  onMatchRemoved?: (matchId: number) => void;
  onLikesUpdated?: () => void;
  onMessageDeleted?: (matchId: number, messageId: number) => void;
  onMessageDelivered?: (matchId: number, messageId: number) => void;
  onPresenceUpdated?: (userId: string, online: boolean) => void;
  onReconnected?: () => void;
}

// If the very first connection fails this many times in a row, the host has no WebSocket
// endpoint (e.g. serverless on Vercel). Stop retrying; callers fall back to polling.
const MAX_INITIAL_CONNECT_FAILURES = 4;

/**
 * Returns whether the live WebSocket is currently connected and authenticated.
 * The socket is created once per signed-in session. Changing `watchedUserId` (opening another
 * chat) only re-sends the presence subscription; it no longer tears the socket down, which
 * previously forced a reconnect + re-auth on every chat switch and made the server think the
 * user had gone offline.
 */
export function useRealtime(
  enabled: boolean,
  handlers: RealtimeHandlers,
  watchedUserId?: string
): boolean {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const authedRef = useRef(false);
  const watchedRef = useRef(watchedUserId);
  watchedRef.current = watchedUserId;

  const sendWatch = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && authedRef.current && watchedRef.current) {
      ws.send(JSON.stringify({ type: 'watch:partner', partnerId: watchedRef.current }));
    }
  };

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let active = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;
    let hasConnectedOnce = false;

    const connect = async () => {
      if (!active) return;

      let token: string | undefined;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token;
      } catch {
        return;
      }
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(url);
      wsRef.current = ws;
      authedRef.current = false;

      ws.onopen = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'auth:ok':
              attempt = 0;
              authedRef.current = true;
              setConnected(true);
              if (hasConnectedOnce) {
                handlersRef.current.onReconnected?.();
              }
              hasConnectedOnce = true;
              sendWatch();
              if (pingTimer) clearInterval(pingTimer);
              pingTimer = setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'ping' }));
                }
              }, 25000);
              break;
            case 'message:created':
              handlersRef.current.onMessageCreated?.(data.matchId, data.message);
              break;
            case 'messages:read':
              handlersRef.current.onMessagesRead?.(
                data.matchId,
                data.readerId,
                data.readAt
              );
              break;
            case 'match:created':
              handlersRef.current.onMatchCreated?.(data.match);
              break;
            case 'match:removed':
              handlersRef.current.onMatchRemoved?.(data.matchId);
              break;
            case 'likes:updated':
              handlersRef.current.onLikesUpdated?.();
              break;
            case 'message:deleted':
              handlersRef.current.onMessageDeleted?.(data.matchId, data.messageId);
              break;
            case 'messages:delivered':
              handlersRef.current.onMessageDelivered?.(data.matchId, data.messageId);
              break;
            case 'presence:updated':
              handlersRef.current.onPresenceUpdated?.(data.userId, Boolean(data.online));
              break;
            default:
              break;
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        authedRef.current = false;
        setConnected(false);
        if (!active) return;
        if (!hasConnectedOnce && attempt + 1 >= MAX_INITIAL_CONNECT_FAILURES) {
          return; // no WebSocket on this host: rely on polling instead of retrying forever
        }
        const delay = Math.min(15000, 1000 * Math.pow(2, attempt));
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
      authedRef.current = false;
    };
  }, [enabled]);

  // Opening another chat only changes which partner's presence we watch
  useEffect(() => {
    sendWatch();
  }, [watchedUserId, connected]);

  return connected;
}
