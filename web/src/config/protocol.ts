/**
 * ConeCurrency Gelateria - Assumed ASCII Protocol Configuration
 * 
 * Centralized definition of ASCII protocol commands, responses, and network defaults.
 * Single source of truth across frontend, bridge server, and mock backend.
 */

export const PROTOCOL_CONFIG = {
  // Default TCP Backend Coordinates
  DEFAULT_BACKEND_HOST: process.env.BACKEND_HOST || '127.0.0.1',
  DEFAULT_BACKEND_PORT: parseInt(process.env.BACKEND_PORT || '8080', 10),

  // Default Bridge WebSocket & HTTP Coordinates
  DEFAULT_BRIDGE_PORT: parseInt(process.env.BRIDGE_PORT || '3001', 10),
  DEFAULT_BRIDGE_WS_URL: 'ws://127.0.0.1:3001',
  DEFAULT_BRIDGE_HTTP_URL: 'http://127.0.0.1:3001',

  // Request Commands (all newline-terminated)
  REQUESTS: {
    BOOK: 'BOOK\n',
    STATUS: 'STATUS\n',
    RESET: 'RESET\n',
  } as const,

  // Response Keywords
  RESPONSES: {
    OK_PREFIX: 'OK',
    SOLD_OUT: 'SOLD_OUT',
    ERR_SOLD_OUT: 'ERR SOLD_OUT',
    BUSY: 'BUSY',
    ERR_BUSY: 'ERR BUSY',
    ERR_PREFIX: 'ERR',
    STATUS_PREFIX: 'STATUS',
  } as const,

  // Timeouts & Limits
  TIMEOUT_MS: 5000,
  MAX_TAPE_ENTRIES: 500,
  MAX_REQ_BYTES: 64,

  // Initial stock for mock backend / consistency tracking
  DEFAULT_STOCK: 50,
} as const;

export type ProtocolRequest = 'BOOK' | 'STATUS' | 'RESET' | string;

export type ParsedResponseStatus = 'OK' | 'SOLD_OUT' | 'BUSY' | 'ERR' | 'STATUS' | 'MALFORMED';

export interface ParsedProtocolResponse {
  raw: string;
  status: ParsedResponseStatus;
  ticketId?: string;
  reason?: string;
  statusData?: {
    booked: number;
    soldOut: number;
    busy: number;
    remaining?: number;
  };
}

/**
 * Parses raw ASCII reply from C backend or mock server.
 * Handles both the prompt specification and real C server variances cleanly:
 * - "OK <ticket_id>\n" or "OK BOOKED\n"
 * - "SOLD_OUT\n" or "ERR SOLD_OUT\n"
 * - "BUSY\n" or "ERR BUSY\n"
 * - "ERR <reason>\n" or "ERR BAD_REQUEST\n"
 * - "STATUS <booked> <sold_out> <busy>\n"
 */
export function parseProtocolResponse(rawResponse: string): ParsedProtocolResponse {
  const trimmed = rawResponse.trim();

  if (!trimmed) {
    return { raw: rawResponse, status: 'MALFORMED', reason: 'Empty response' };
  }

  // STATUS response
  if (trimmed.startsWith('STATUS') || trimmed.includes('booked=')) {
    let booked = 0;
    let soldOut = 0;
    let busy = 0;

    const match = trimmed.match(/booked=(\d+)\s+sold_out=(\d+)\s+busy=(\d+)/i);
    if (match) {
      booked = parseInt(match[1], 10);
      soldOut = parseInt(match[2], 10);
      busy = parseInt(match[3], 10);
    } else {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        booked = parseInt(parts[1], 10) || 0;
        soldOut = parseInt(parts[2], 10) || 0;
        busy = parseInt(parts[3], 10) || 0;
      }
    }

    return {
      raw: rawResponse,
      status: 'STATUS',
      statusData: { booked, soldOut, busy },
    };
  }

  // OK response: "OK <ticket_id>" or "OK BOOKED"
  if (trimmed.startsWith('OK')) {
    const parts = trimmed.split(/\s+/, 2);
    const ticketId = parts[1] || 'BOOKED';
    return {
      raw: rawResponse,
      status: 'OK',
      ticketId,
    };
  }

  // SOLD_OUT response: "SOLD_OUT" or "ERR SOLD_OUT"
  if (trimmed === 'SOLD_OUT' || trimmed === 'ERR SOLD_OUT') {
    return {
      raw: rawResponse,
      status: 'SOLD_OUT',
      reason: 'All cones sold out',
    };
  }

  // BUSY response: "BUSY" or "ERR BUSY"
  if (trimmed === 'BUSY' || trimmed === 'ERR BUSY') {
    return {
      raw: rawResponse,
      status: 'BUSY',
      reason: 'Server queue full (shedding load)',
    };
  }

  // ERR response: "ERR <reason>"
  if (trimmed.startsWith('ERR')) {
    const reason = trimmed.substring(3).trim() || 'General server error';
    return {
      raw: rawResponse,
      status: 'ERR',
      reason,
    };
  }

  return {
    raw: rawResponse,
    status: 'MALFORMED',
    reason: `Unrecognized response: ${trimmed}`,
  };
}

/**
 * Serializes command to newline-terminated ASCII protocol buffer.
 */
export function serializeProtocolRequest(command: string): Buffer {
  const sanitized = command.endsWith('\n') ? command : `${command}\n`;
  return Buffer.from(sanitized, 'ascii');
}

