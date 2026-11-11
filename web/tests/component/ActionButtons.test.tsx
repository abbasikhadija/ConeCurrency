import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ActionButtons } from '../../src/components/ActionButtons.js';

describe('ActionButtons Component', () => {
  it('triggers action handlers when clicked', () => {
    const onOrderOne = vi.fn();
    const onRushHour = vi.fn();
    const onFlashMob = vi.fn();
    const onSendBad = vi.fn();

    render(
      <ActionButtons
        onOrderOne={onOrderOne}
        onRushHour={onRushHour}
        onFlashMob={onFlashMob}
        onSendBad={onSendBad}
        disabled={false}
      />
    );

    fireEvent.click(screen.getByTestId('btn-book'));
    expect(onOrderOne).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('btn-rush'));
    expect(onRushHour).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('btn-flash'));
    expect(onFlashMob).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('btn-bad'));
    expect(onSendBad).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when backend is unreachable', () => {
    const onOrderOne = vi.fn();

    render(
      <ActionButtons
        onOrderOne={onOrderOne}
        onRushHour={vi.fn()}
        onFlashMob={vi.fn()}
        onSendBad={vi.fn()}
        disabled={true}
      />
    );

    const bookBtn = screen.getByTestId('btn-book');
    expect(bookBtn).toBeDisabled();

    fireEvent.click(bookBtn);
    expect(onOrderOne).not.toHaveBeenCalled();
  });
});

