import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RaceConditionBanner } from '../../src/components/RaceConditionBanner.js';

describe('RaceConditionBanner Component', () => {
  it('renders nothing when isDetected is false', () => {
    const { container } = render(<RaceConditionBanner isDetected={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders prominent warning banner when isDetected is true', () => {
    const onLearnMore = vi.fn();
    render(<RaceConditionBanner isDetected={true} onLearnMore={onLearnMore} />);

    expect(screen.getByTestId('race-condition-banner')).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL INVARIANT VIOLATION: RACE CONDITION DETECTED!/i)).toBeInTheDocument();

    const learnBtn = screen.getByText('How Mutex Fixes This');
    fireEvent.click(learnBtn);
    expect(onLearnMore).toHaveBeenCalledTimes(1);
  });
});

