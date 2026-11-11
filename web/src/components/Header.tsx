import React from 'react';
import { ConnectionStatus } from '../types/index.js';
import { Volume2, VolumeX, HelpCircle, BookOpen, LayoutDashboard } from 'lucide-react';
import { Tooltip } from './Tooltip.js';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenHelp: () => void;
  activeTab: 'dashboard' | 'learn';
  onTabChange: (tab: 'dashboard' | 'learn') => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  soundEnabled,
  onToggleSound,
  onOpenHelp,
  activeTab,
  onTabChange,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          dotClass: 'status-dot online',
          text: 'Backend Connected',
          badgeClass: 'status-badge-connected',
        };
      case 'reconnecting':
        return {
          dotClass: 'status-dot reconnecting',
          text: 'Reconnecting…',
          badgeClass: 'status-badge-reconnecting',
        };
      case 'unreachable':
      default:
        return {
          dotClass: 'status-dot offline',
          text: 'Backend Unreachable',
          badgeClass: 'status-badge-unreachable',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <header className="header-card" role="banner">
      <div className="header-brand">
        <div className="brand-logo" aria-hidden="true">
          🍦
        </div>
        <div className="brand-titles">
          <h1 className="brand-title">ConeCurrency Gelateria</h1>
          <p className="brand-subtitle">CONCURRENT POSIX TICKET BOOKING ENGINE</p>
        </div>
      </div>

      <div className="header-nav-actions">
        {/* Navigation Tabs */}
        <div className="nav-tab-group" role="tablist" aria-label="Page Navigation">
          <button
            role="tab"
            aria-selected={activeTab === 'dashboard'}
            className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
          >
            <LayoutDashboard size={15} />
            <span>Parlour</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'learn'}
            className={`nav-tab-btn ${activeTab === 'learn' ? 'active' : ''}`}
            onClick={() => onTabChange('learn')}
          >
            <BookOpen size={15} />
            <span>How it Works</span>
          </button>
        </div>

        {/* Audio Toggle */}
        <Tooltip content={soundEnabled ? 'Mute Sounds' : 'Enable Gelato Sounds'}>
          <button
            className={`icon-action-btn ${soundEnabled ? 'active' : ''}`}
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </Tooltip>

        {/* Keyboard Help */}
        <Tooltip content="Keyboard Shortcuts (?)">
          <button
            className="icon-action-btn"
            onClick={onOpenHelp}
            aria-label="View keyboard shortcuts"
          >
            <HelpCircle size={16} />
          </button>
        </Tooltip>

        {/* Status Pill Badge */}
        <div
          className={`status-pill ${status.badgeClass}`}
          role="status"
          aria-live="polite"
        >
          <span className={`status-dot ${status.dotClass}`} aria-hidden="true" />
          <span className="status-text">{status.text}</span>
        </div>
      </div>
    </header>
  );
};

