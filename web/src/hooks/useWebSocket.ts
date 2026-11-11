import { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectionStatus, DashboardStats, TapeEntry } from '../types/index.js';
import { PROTOCOL_CONFIG } from '../config/protocol.js';
import { INITIAL_STATS } from '../utils/formatters.js';

interface UseWebSocketOptions {
  url?: string;
  onTapeEntry?: (entry: TapeEntry) => void;
  onBackendStatusChange?: (connected: boolean) => void;
}

export function useWebSocket({
  url = PROTOCOL_CONFIG.DEFAULT_BRIDGE_WS_URL,
  onTapeEntry,
  onBackendStatusChange,
}: UseWebSocketOptions = {}) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('reconnecting');
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [tapeEntries, setTapeEntries] = useState<TapeEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onTapeEntryRef = useRef(onTapeEntry);
  const onBackendStatusChangeRef = useRef(onBackendStatusChange);

  onTapeEntryRef.current = onTapeEntry;
  onBackendStatusChangeRef.current = onBackendStatusChange;

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus('reconnecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        // WebSocket bridge is open, status depends on backend connection
        setConnectionStatus(backendConnected ? 'connected' : 'unreachable');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'INIT_STATE') {
            setBackendConnected(data.connected);
            setConnectionStatus(data.connected ? 'connected' : 'unreachable');
            if (data.stats) setStats(data.stats);
            onBackendStatusChangeRef.current?.(data.connected);
          } else if (data.type === 'BACKEND_STATUS') {
            setBackendConnected(data.connected);
            setConnectionStatus(data.connected ? 'connected' : 'unreachable');
            if (data.stats) setStats(data.stats);
            onBackendStatusChangeRef.current?.(data.connected);
          } else if (data.type === 'TAPE_ENTRY') {
            const entry: TapeEntry = data.entry;
            setTapeEntries((prev) => {
              const updated = [entry, ...prev];
              return updated.slice(0, PROTOCOL_CONFIG.MAX_TAPE_ENTRIES);
            });
            if (data.stats) setStats(data.stats);
            onTapeEntryRef.current?.(entry);
          } else if (data.type === 'RESET_STATE') {
            if (data.stats) setStats(data.stats);
          }
        } catch (e) {
          console.error('[WS Parse Error]', e);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setConnectionStatus('unreachable');
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      scheduleReconnect();
    }
  }, [url, backendConnected]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    const delay = Math.min(500 * Math.pow(1.5, reconnectAttemptRef.current), 5000);
    reconnectAttemptRef.current++;

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((payload: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const orderOne = useCallback(() => send({ type: 'BOOK' }), [send]);
  const orderBurst = useCallback((count: number) => send({ type: 'BURST', count }), [send]);
  const sendBad = useCallback(() => send({ type: 'BAD_REQUEST' }), [send]);
  const resetCounters = useCallback(() => send({ type: 'RESET' }), [send]);
  const clearTape = useCallback(() => setTapeEntries([]), []);

  return {
    connectionStatus,
    backendConnected,
    stats,
    tapeEntries,
    orderOne,
    orderBurst,
    sendBad,
    resetCounters,
    clearTape,
  };
}

