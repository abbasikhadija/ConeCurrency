import React from 'react';
import { DashboardStats, ScoopItem } from '../types/index.js';
import { StatsStrip } from './StatsStrip.js';
import { ConeStage } from './ConeStage.js';
import { ActionButtons } from './ActionButtons.js';
import { RotateCcw } from 'lucide-react';

interface ParlourCounterProps {
  stats: DashboardStats;
  scoops: ScoopItem[];
  isSoldOutTriggered: boolean;
  isBusyTriggered: boolean;
  isBadTriggered: boolean;
  isScreenShaking: boolean;
  onOrderOne: () => void;
  onRushHour: () => void;
  onFlashMob: () => void;
  onSendBad: () => void;
  onResetCounters: () => void;
  backendConnected: boolean;
}

export const ParlourCounter: React.FC<ParlourCounterProps> = ({
  stats,
  scoops,
  isSoldOutTriggered,
  isBusyTriggered,
  isBadTriggered,
  isScreenShaking,
  onOrderOne,
  onRushHour,
  onFlashMob,
  onSendBad,
  onResetCounters,
  backendConnected,
}) => {
  return (
    <div className="card parlour-counter-card" role="region" aria-label="Parlour Counter Controls and Stage">
      {/* Card Header with Reset Counters Ghost Button */}
      <div className="counter-card-header">
        <h2 className="counter-card-title">Parlour Counter</h2>
        <button
          className="btn-ghost-reset"
          onClick={onResetCounters}
          aria-label="Reset inventory and counters to initial state"
          data-testid="btn-reset-counters"
        >
          <RotateCcw size={13} />
          <span>Reset Counters</span>
        </button>
      </div>

      {/* 1. Stats Strip */}
      <StatsStrip stats={stats} />

      {/* 2. Cone Stage Visualizer */}
      <ConeStage
        scoops={scoops}
        isSoldOutTriggered={isSoldOutTriggered}
        isBusyTriggered={isBusyTriggered}
        isBadTriggered={isBadTriggered}
        isScreenShaking={isScreenShaking}
      />

      {/* 3. Action Buttons */}
      <ActionButtons
        onOrderOne={onOrderOne}
        onRushHour={onRushHour}
        onFlashMob={onFlashMob}
        onSendBad={onSendBad}
        disabled={!backendConnected}
      />
    </div>
  );
};

