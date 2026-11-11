import React from 'react';
import { Zap, Flame, AlertTriangle, IceCream } from 'lucide-react';
import { Tooltip } from './Tooltip.js';

interface ActionButtonsProps {
  onOrderOne: () => void;
  onRushHour: () => void;
  onFlashMob: () => void;
  onSendBad: () => void;
  disabled: boolean;
  disabledReason?: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onOrderOne,
  onRushHour,
  onFlashMob,
  onSendBad,
  disabled,
  disabledReason = 'Backend Unreachable - Check C Server on 127.0.0.1:8080',
}) => {
  const renderButton = (
    btnClass: string,
    onClick: () => void,
    icon: React.ReactNode,
    label: string,
    shortcut: string,
    tooltipText: string,
    testId: string
  ) => {
    const content = disabled ? (
      <Tooltip content={disabledReason}>
        <button
          className={`action-btn ${btnClass}`}
          disabled
          aria-disabled="true"
          data-testid={testId}
        >
          <span className="btn-icon">{icon}</span>
          <span className="btn-label">{label}</span>
          <kbd className="btn-shortcut">{shortcut}</kbd>
        </button>
      </Tooltip>
    ) : (
      <Tooltip content={tooltipText}>
        <button
          className={`action-btn ${btnClass}`}
          onClick={onClick}
          data-testid={testId}
          aria-label={`${label} (Shortcut: ${shortcut})`}
        >
          <span className="btn-icon">{icon}</span>
          <span className="btn-label">{label}</span>
          <kbd className="btn-shortcut">{shortcut}</kbd>
        </button>
      </Tooltip>
    );

    return content;
  };

  return (
    <div className="action-buttons-grid" role="group" aria-label="Order and Simulation Actions">
      {/* 1. Order 1 Cone */}
      {renderButton(
        'btn-raspberry',
        onOrderOne,
        <IceCream size={16} />,
        'Order 1 Cone (BOOK)',
        'B',
        'Sends 1 atomic BOOK request over TCP',
        'btn-book'
      )}

      {/* 2. Rush Hour (10 Cones) */}
      {renderButton(
        'btn-caramel',
        onRushHour,
        <Zap size={16} />,
        'Rush Hour (10 Cones)',
        'R',
        'Fires 10 parallel TCP socket connections simultaneously',
        'btn-rush'
      )}

      {/* 3. Flash Mob (25 Cones) */}
      {renderButton(
        'btn-caramel',
        onFlashMob,
        <Flame size={16} />,
        'Flash Mob (25 Cones)',
        'F',
        'Fires 25 parallel TCP socket connections (tests queue shedding & contention)',
        'btn-flash'
      )}

      {/* 4. Send Bad Request */}
      {renderButton(
        'btn-bad-request',
        onSendBad,
        <AlertTriangle size={16} />,
        'Send Bad Request',
        'X',
        'Sends malformed ASCII payload to verify server error rejection',
        'btn-bad'
      )}
    </div>
  );
};

