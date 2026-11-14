// Manager's briefing and shift preview tests — Sadia Fatima
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShiftBriefing, { ShiftConfig, shiftStatus, waitWarning } from '../../src/admin/ShiftBriefing';
import ShiftPreview from '../../src/admin/ShiftPreview';

const config: ShiftConfig = {mode: 'concurrent', tickets: 5, workers: 2, queue: 8, delayMs: 1500};

describe('ShiftBriefing', () => {
  it('types the briefing line by line, revealing each control only after its question', () => {
    vi.useFakeTimers();
    render(<ShiftBriefing config={config} setConfig={vi.fn()} round={null} sending={false} onStart={vi.fn()}/>);
    expect(screen.queryByLabelText('Cones in the freezer')).not.toBeInTheDocument();
    // Each typed character schedules the next one, so step the clock repeatedly.
    for (let i = 0; i < 12; i++) act(() => { vi.advanceTimersByTime(20); });
    expect(document.querySelector('.briefing-text')?.textContent).toBe('Good morning');   // typed so far
    expect(screen.queryByLabelText('Service style')).not.toBeInTheDocument();
    for (let i = 0; i < 1500; i++) act(() => { vi.advanceTimersByTime(20); });
    expect(screen.getByLabelText('Cones in the freezer')).toHaveValue(5);
    expect(screen.getByText('All set. Shall I open the shop?')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('"Show everything" reveals the whole briefing at once and edits update the config', () => {
    const setConfig = vi.fn();
    render(<ShiftBriefing config={config} setConfig={setConfig} round={null} sending={false} onStart={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Show everything'}));
    fireEvent.change(screen.getByLabelText('Cashiers on shift'), {target: {value: '4'}});
    expect(setConfig).toHaveBeenCalledWith({...config, workers: 4});
    fireEvent.change(screen.getByLabelText('Service style'), {target: {value: 'sequential'}});
    expect(setConfig).toHaveBeenCalledWith({...config, mode: 'sequential'});
  });

  it('opens the shop, and blocks a new shift while orders are in progress', () => {
    const onStart = vi.fn();
    const {rerender} = render(<ShiftBriefing config={config} setConfig={vi.fn()} round={{round: 0, managed: false, enabled: true, pending: 0}} sending={false} onStart={onStart}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Show everything'}));
    fireEvent.click(screen.getByRole('button', {name: 'Open the shop'}));
    expect(onStart).toHaveBeenCalledOnce();
    rerender(<ShiftBriefing config={config} setConfig={vi.fn()} round={{round: 2, managed: true, enabled: true, pending: 3, config}} sending={false} onStart={onStart}/>);
    expect(screen.getByRole('button', {name: 'Start a new shift'})).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Shop open · shift 2 · 2 cashiers serve together · orders in progress: 3');
  });

  it('disables the cashier count in one-at-a-time mode', () => {
    render(<ShiftBriefing config={{...config, mode: 'sequential'}} setConfig={vi.fn()} round={null} sending={false} onStart={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Show everything'}));
    expect(screen.getByLabelText('Cashiers on shift')).toBeDisabled();
    expect(screen.getByText('Only one cashier works in one-at-a-time mode.')).toBeInTheDocument();
  });
});

describe('shift helpers', () => {
  it('describes the shop in plain language', () => {
    expect(shiftStatus({round: 0, managed: false, enabled: false})).toBe('Shop controls are off: the server was started outside this page.');
    expect(shiftStatus({round: 0, managed: false, enabled: true})).toBe('The shop is closed. Open it to start a shift.');
    expect(shiftStatus({round: 3, managed: true, config: {...config, mode: 'sequential'}})).toBe('Shop open · shift 3 · one cashier serves at a time');
  });
  it('warns only when late customers would exceed the 5 s bridge limit', () => {
    expect(waitWarning({...config, delayMs: 500, workers: 4, queue: 32})).toBeNull();   // 40 served in 5 s ≥ 36
    expect(waitWarning({...config, delayMs: 2500, workers: 2, queue: 8})).toMatch(/only about 4 customers/);
    expect(waitWarning({...config, delayMs: 0})).toBeNull();
  });
});

describe('ShiftPreview', () => {
  it('draws the freezer, cashiers on shift and waiting places', () => {
    render(<ShiftPreview config={config}/>);
    expect(screen.getByLabelText('Freezer: 5 cones').textContent).toBe('🍦'.repeat(5));
    expect(screen.getByLabelText('Cashiers: 2 on shift')).toBeInTheDocument();
    expect(screen.getByLabelText('Waiting line: room for 8').children).toHaveLength(8);
    expect(screen.getByText('⏱ 1.5 s')).toBeInTheDocument();
  });
  it('shows one cashier in one-at-a-time mode and caps long rows', () => {
    render(<ShiftPreview config={{...config, mode: 'sequential', workers: 6, tickets: 100}}/>);
    expect(screen.getByLabelText('Cashiers: 1 on shift')).toHaveTextContent('one at a time');
    expect(screen.getByText('+76')).toBeInTheDocument();
  });
});
