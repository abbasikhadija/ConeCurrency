import { describe, it, expect } from 'vitest';
import { parseProtocolResponse, serializeProtocolRequest } from '../../src/config/protocol.js';

describe('ASCII Protocol Parser & Serializer', () => {
  it('parses OK responses with ticket ID and BOOKED variant', () => {
    const res1 = parseProtocolResponse('OK CONE-0042\n');
    expect(res1.status).toBe('OK');
    expect(res1.ticketId).toBe('CONE-0042');

    const res2 = parseProtocolResponse('OK BOOKED\n');
    expect(res2.status).toBe('OK');
    expect(res2.ticketId).toBeUndefined();
  });

  it('parses SOLD_OUT responses (both prompt and C spec)', () => {
    expect(parseProtocolResponse('SOLD_OUT\n').status).toBe('SOLD_OUT');
    expect(parseProtocolResponse('ERR SOLD_OUT\n').status).toBe('SOLD_OUT');
  });

  it('parses BUSY responses (both prompt and C spec)', () => {
    expect(parseProtocolResponse('BUSY\n').status).toBe('BUSY');
    expect(parseProtocolResponse('ERR BUSY\n').status).toBe('BUSY');
  });

  it('parses general ERR responses', () => {
    const err = parseProtocolResponse('ERR BAD_REQUEST\n');
    expect(err.status).toBe('ERR');
    expect(err.reason).toBe('BAD_REQUEST');
  });

  it('parses STATUS formatted string with metrics', () => {
    const stat1 = parseProtocolResponse('STATUS 25 10 3\n');
    expect(stat1.status).toBe('STATUS');
    expect(stat1.statusData).toEqual({ booked: 25, soldOut: 10, busy: 3 });

    // Also handles C server stats_print output
    const stat2 = parseProtocolResponse('ConeCurrency stats: booked=14 sold_out=4 busy=1 bad=0 remaining=31\n');
    expect(stat2.status).toBe('STATUS');
    expect(stat2.statusData).toEqual({ booked: 14, soldOut: 4, busy: 1 });
  });

  it('handles edge cases: empty, huge, and malformed lines', () => {
    expect(parseProtocolResponse('').status).toBe('MALFORMED');
    expect(parseProtocolResponse('   \n\t').status).toBe('MALFORMED');

    const hugeLine = 'GIBBERISH_'.repeat(100);
    const parsed = parseProtocolResponse(hugeLine);
    expect(parsed.status).toBe('MALFORMED');
  });

  it('serializes commands to ASCII buffer with trailing newline', () => {
    const b1 = serializeProtocolRequest('BOOK');
    expect(b1.toString('ascii')).toBe('BOOK\n');

    const b2 = serializeProtocolRequest('RESET\n');
    expect(b2.toString('ascii')).toBe('RESET\n');
  });
});

