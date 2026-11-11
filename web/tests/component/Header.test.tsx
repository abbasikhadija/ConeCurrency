import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Header } from '../../src/components/Header.js';

describe('Header Component', () => {
  it('renders title and small-caps subtitle accurately', () => {
    render(
      <Header
        connectionStatus="connected"
        soundEnabled={false}
        onToggleSound={vi.fn()}
        onOpenHelp={vi.fn()}
        activeTab="dashboard"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('ConeCurrency Gelateria')).toBeInTheDocument();
    expect(screen.getByText('CONCURRENT POSIX TICKET BOOKING ENGINE')).toBeInTheDocument();
  });

  it('renders Backend Connected status pill when connected', () => {
    render(
      <Header
        connectionStatus="connected"
        soundEnabled={false}
        onToggleSound={vi.fn()}
        onOpenHelp={vi.fn()}
        activeTab="dashboard"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Backend Connected')).toBeInTheDocument();
  });

  it('renders Backend Unreachable when offline', () => {
    render(
      <Header
        connectionStatus="unreachable"
        soundEnabled={false}
        onToggleSound={vi.fn()}
        onOpenHelp={vi.fn()}
        activeTab="dashboard"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Backend Unreachable')).toBeInTheDocument();
  });

  it('renders Reconnecting… when attempting connection', () => {
    render(
      <Header
        connectionStatus="reconnecting"
        soundEnabled={false}
        onToggleSound={vi.fn()}
        onOpenHelp={vi.fn()}
        activeTab="dashboard"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('handles tab switches and sound toggle clicks', () => {
    const onTabChange = vi.fn();
    const onToggleSound = vi.fn();

    render(
      <Header
        connectionStatus="connected"
        soundEnabled={false}
        onToggleSound={onToggleSound}
        onOpenHelp={vi.fn()}
        activeTab="dashboard"
        onTabChange={onTabChange}
      />
    );

    const learnTab = screen.getByText('How it Works');
    fireEvent.click(learnTab);
    expect(onTabChange).toHaveBeenCalledWith('learn');

    const soundBtn = screen.getByLabelText('Enable sound effects');
    fireEvent.click(soundBtn);
    expect(onToggleSound).toHaveBeenCalled();
  });
});

