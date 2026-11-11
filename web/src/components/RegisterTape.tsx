import React, { useEffect, useRef } from 'react';
import { TapeEntry } from '../types/index.js';
import { Trash2 } from 'lucide-react';
import { formatLatency } from '../utils/latency.js';

interface RegisterTapeProps {
  entries: TapeEntry[];
  onClear: () => void;
  backendHost?: string;
  backendPort?: number;
}

export const RegisterTape: React.FC<RegisterTapeProps> = ({
  entries,
  onClear,
  backendHost = '127.0.0.1',
  backendPort = 8080,
}) => {
  const tapeStreamRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to top of stream when new entry arrives
  useEffect(() => {
    if (tapeStreamRef.current) {
      tapeStreamRef.current.scrollTop = 0;
    }
  }, [entries.length]);

  const getStatusColorClass = (status: TapeEntry['status']) => {
    switch (status) {
      case 'OK':
        return 'tape-status-ok'; // Green
      case 'SOLD_OUT':
        return 'tape-status-soldout'; // Red
      case 'BUSY':
        return 'tape-status-busy'; // Orange
      case 'ERR':
      case 'MALFORMED':
      case 'TIMEOUT':
      default:
        return 'tape-status-err'; // Grey
    }
  };

  return (
    <div className="card register-tape-card" role="region" aria-label="Register Tape POS Feed">
      {/* Receipt zig-zag jagged edge */}
      <div className="receipt-jagged-edge" aria-hidden="true" />

      {/* Card Header with Clear button */}
      <div className="tape-card-header">
        <h2 className="tape-title">Register Tape (POS)</h2>
        <button
          className="btn-clear-tape"
          onClick={onClear}
          aria-label="Clear register tape log"
          data-testid="btn-clear-tape"
        >
          <Trash2 size={13} />
          <span>Clear (C)</span>
        </button>
      </div>

      {/* Monospace receipt header */}
      <div className="receipt-mono-header" aria-hidden="true">
        <div className="mono-banner">*** REAL-TIME TCP STREAM ***</div>
        <div className="mono-coords">
          {backendHost}:{backendPort} &bull; ASCII PROTOCOL
        </div>
        <div className="mono-divider" />
      </div>

      {/* Live scrollable stream */}
      <div
        className="tape-stream-container"
        ref={tapeStreamRef}
        role="log"
        aria-live="polite"
        aria-label="Real-time TCP event log"
        data-testid="tape-stream"
      >
        {entries.length === 0 ? (
          <div className="tape-empty-state">
            [Ready for client traffic &bull; Awaiting BOOK]
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`tape-log-row ${getStatusColorClass(entry.status)}`}
              data-testid="tape-entry-row"
            >
              <div className="row-main">
                <span className="row-time">{entry.timestamp}</span>
                <span className="row-command">{entry.command}</span>
                <span className="row-arrow">&rarr;</span>
                <span className="row-reply">{entry.rawResponse}</span>
              </div>
              <div className="row-meta">
                <span className="row-latency">{formatLatency(entry.latencyMs)}ms</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom dashed footer */}
      <div className="receipt-mono-footer" aria-hidden="true">
        <div className="mono-divider" />
        <div className="footer-entry-count">
          BUFFER: {entries.length} / 500 ENTRIES
        </div>
      </div>
    </div>
  );
};

