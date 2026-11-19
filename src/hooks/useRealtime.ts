import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ChatMessage, MatchSummary } from '../types/nearu';

export interface RealtimeHandlers {
  onMessageCreated?: (matchId: number, message: ChatMessage) => void;
  onMessagesRead?: (matchId: number, readerId: string, readAt: string) => void;
  onMatchCreated?: (match: MatchSummary) => void;
  onMatchRemoved?: (matchId: number) => void;
  onReconnected?: () => void;
}

export function useRealtime(enabled: boolean, handlers: RealtimeHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

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
              if (hasConnectedOnce) {
                handlersRef.current.onReconnected?.();
              }
              hasConnectedOnce = true;
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
        if (!active) return;
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
    };
  }, [enabled]);
}
