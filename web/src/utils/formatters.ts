import { DashboardStats, TapeEntry, ScoopFlavor } from '../types/index.js';
import { PROTOCOL_CONFIG } from '../config/protocol.js';

export const INITIAL_STATS: DashboardStats = {
  booked: 0,
  soldOut: 0,
  busy: 0,
  bad: 0,
  avgLatencyMs: 0.0,
  totalRequests: 0,
  seenTicketIds: [],
  raceConditionDetected: false,
};

/**
 * Pure stats reducer that updates dashboard metrics based on incoming tape entries.
 * Detects race conditions when tickets oversell past stock or duplicate IDs appear.
 */
export function reduceStats(
  current: DashboardStats = INITIAL_STATS,
  entry?: Partial<TapeEntry>,
  maxStock: number = PROTOCOL_CONFIG.DEFAULT_STOCK
): DashboardStats {
  if (!entry || !entry.status) {
    return { ...current };
  }

  const next: DashboardStats = {
    ...current,
    totalRequests: current.totalRequests + 1,
    seenTicketIds: [...current.seenTicketIds],
  };

  switch (entry.status) {
    case 'OK': {
      next.booked++;
      if (entry.ticketId) {
        if (next.seenTicketIds.includes(entry.ticketId)) {
          // DUPLICATE TICKET ID -> RACE CONDITION!
          next.raceConditionDetected = true;
        } else {
          next.seenTicketIds.push(entry.ticketId);
        }
      }
      break;
    }
    case 'SOLD_OUT':
      next.soldOut++;
      break;
    case 'BUSY':
      next.busy++;
      break;
    case 'ERR':
    case 'MALFORMED':
    case 'TIMEOUT':
    default:
      next.bad++;
      break;
  }

  // Inventory consistency check
  if (next.booked > maxStock) {
    next.raceConditionDetected = true;
  }

  return next;
}

export const FLAVOR_COLORS: Record<ScoopFlavor, { bg: string; border: string; label: string }> = {
  strawberry: { bg: '#FF7597', border: '#E85D75', label: 'Wild Strawberry' },
  pistachio: { bg: '#82C4A2', border: '#5E9B7C', label: 'Bronte Pistachio' },
  vanilla: { bg: '#FFF1CC', border: '#EBD292', label: 'Madagascar Vanilla' },
  chocolate: { bg: '#684E45', border: '#4E372F', label: 'Dark Gianduja' },
  mango: { bg: '#FFB347', border: '#E29528', label: 'Alphonso Mango' },
};

export const FLAVOR_CYCLE: ScoopFlavor[] = ['strawberry', 'pistachio', 'vanilla', 'chocolate', 'mango'];

export function getFlavorByIndex(index: number): ScoopFlavor {
  return FLAVOR_CYCLE[Math.abs(index) % FLAVOR_CYCLE.length];
}

