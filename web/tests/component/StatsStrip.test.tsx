import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatsStrip } from '../../src/components/StatsStrip.js';
import { DashboardStats } from '../../src/types/index.js';

describe('StatsStrip Component', () => {
  const mockStats: DashboardStats = {
    booked: 42,
    soldOut: 8,
    busy: 3,
    bad: 1,
    avgLatencyMs: 18.6,
    totalRequests: 54,
    seenTicketIds: [],
    raceConditionDetected: false,
  };

  it('renders all 4 metrics with correct values and labels', () => {
    render(<StatsStrip stats={mockStats} />);

    expect(screen.getByText('BOOKED CONES')).toBeInTheDocument();
    expect(screen.getByTestId('stat-booked')).toHaveTextContent('42');

    expect(screen.getByText('SOLD OUT')).toBeInTheDocument();
    expect(screen.getByTestId('stat-soldout')).toHaveTextContent('8');

    expect(screen.getByText('QUEUE SHED (BUSY)')).toBeInTheDocument();
    expect(screen.getByTestId('stat-busy')).toHaveTextContent('3');

    expect(screen.getByText('AVG LATENCY (MS)')).toBeInTheDocument();
    expect(screen.getByTestId('stat-latency')).toHaveTextContent('18.6');
  });
});

