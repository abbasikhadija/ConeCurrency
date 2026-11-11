export type ConnectionStatus = 'connected' | 'unreachable' | 'reconnecting';

export type ResponseStatus = 'OK' | 'SOLD_OUT' | 'BUSY' | 'ERR' | 'MALFORMED' | 'TIMEOUT';

export interface DashboardStats {
  booked: number;
  soldOut: number;
  busy: number;
  bad: number;
  avgLatencyMs: number;
  totalRequests: number;
  seenTicketIds: string[];
  raceConditionDetected: boolean;
}

export interface TapeEntry {
  id: string;
  timestamp: string;
  command: string;
  rawResponse: string;
  status: ResponseStatus;
  ticketId?: string;
  reason?: string;
  latencyMs: number;
}

export type ScoopFlavor = 'strawberry' | 'pistachio' | 'vanilla' | 'chocolate' | 'mango';

export interface ScoopItem {
  id: string;
  flavor: ScoopFlavor;
  timestamp: number;
  hasCherry?: boolean;
  hasSprinkles?: boolean;
  isMelting?: boolean;
  isBounced?: boolean;
}

export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

