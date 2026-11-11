import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RegisterTape } from '../../src/components/RegisterTape.js';
import { TapeEntry } from '../../src/types/index.js';

describe('RegisterTape Component', () => {
  const mockEntries: TapeEntry[] = [
    {
      id: '1',
      timestamp: '14:20:01',
      command: 'BOOK',
      rawResponse: 'OK CONE-0001',
      status: 'OK',
      ticketId: 'CONE-0001',
      latencyMs: 14.2,
    },
    {
      id: '2',
      timestamp: '14:20:05',
      command: 'BOOK',
      rawResponse: 'SOLD_OUT',
      status: 'SOLD_OUT',
      latencyMs: 3.1,
    },
  ];

  it('renders receipt header and entries cleanly', () => {
    render(<RegisterTape entries={mockEntries} onClear={vi.fn()} />);

    expect(screen.getByText('*** REAL-TIME TCP STREAM ***')).toBeInTheDocument();
    expect(screen.getByText('127.0.0.1:8080 • ASCII PROTOCOL')).toBeInTheDocument();
    expect(screen.getByText('OK CONE-0001')).toBeInTheDocument();
    expect(screen.getByText('SOLD_OUT')).toBeInTheDocument();
  });

  it('shows empty state when no entries exist', () => {
    render(<RegisterTape entries={[]} onClear={vi.fn()} />);
    expect(screen.getByText(/Ready for client traffic/i)).toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(<RegisterTape entries={mockEntries} onClear={onClear} />);

    const clearBtn = screen.getByTestId('btn-clear-tape');
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

