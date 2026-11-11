import React from 'react';
import { DashboardStats } from '../types/index.js';
import { Tooltip } from './Tooltip.js';
import { formatLatency } from '../utils/latency.js';

interface StatsStripProps {
  stats: DashboardStats;
}

export const StatsStrip: React.FC<StatsStripProps> = ({ stats }) => {
  return (
    <div className="stats-strip" role="region" aria-label="Parlour Statistics">
      {/* 1. BOOKED CONES */}
      <Tooltip content="Total successful tickets reserved atomically under POSIX mutex lock (OK)">
        <div className="stat-item stat-booked" tabIndex={0}>
          <div className="stat-number" data-testid="stat-booked">
            {stats.booked}
          </div>
          <div className="stat-label">BOOKED CONES</div>
        </div>
      </Tooltip>

      {/* 2. SOLD OUT */}
      <Tooltip content="Requests rejected because shared inventory count reached 0 (SOLD_OUT)">
        <div className="stat-item stat-soldout" tabIndex={0}>
          <div className="stat-number" data-testid="stat-soldout">
            {stats.soldOut}
          </div>
          <div className="stat-label">SOLD OUT</div>
        </div>
      </Tooltip>

      {/* 3. QUEUE SHED (BUSY) */}
      <Tooltip content="Requests rejected immediately because the bounded task queue was full (BUSY backpressure)">
        <div className="stat-item stat-busy" tabIndex={0}>
          <div className="stat-number" data-testid="stat-busy">
            {stats.busy}
          </div>
          <div className="stat-label">QUEUE SHED (BUSY)</div>
        </div>
      </Tooltip>

      {/* 4. AVG LATENCY (MS) */}
      <Tooltip content="Rolling average round-trip time per TCP request (includes connection, queue wait, and mutex lock contention)">
        <div className="stat-item stat-latency" tabIndex={0}>
          <div className="stat-number" data-testid="stat-latency">
            {formatLatency(stats.avgLatencyMs)}
          </div>
          <div className="stat-label">AVG LATENCY (MS)</div>
        </div>
      </Tooltip>
    </div>
  );
};

