// Shop floor view tests — Sadia Fatima (P3)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import ShopFloor, { ShopFloorView, ShopSnapshot, youText } from '../../src/student/ShopFloor';

const shop = (over: Partial<ShopSnapshot> = {}): ShopSnapshot => ({
  managed: true, mode: 'concurrent', cashiers: 2, queueCapacity: 8, delayMs: 500,
  stock: {initial: 10, remaining: 6},
  counters: [{name: 'Ali', you: false, waitedMs: 300}],
  line: [{name: 'Sadia', you: true, position: 1, waitedMs: 200}, {name: 'Bilal', you: false, position: 2, waitedMs: 100}],
  crowd: 0, recent: [{name: 'Omar', status: 'OK', latencyMs: 520, finishedAt: 1}], estimated: true, ...over,
});

describe('ShopFloorView', () => {
  it('draws one counter per cashier, with busy and free stations', () => {
    render(<ShopFloorView shop={shop()}/>);
    const counters = within(screen.getByLabelText('Cashier counters (worker threads)'));
    expect(counters.getByText('Ali')).toBeInTheDocument();
    expect(counters.getByText('Free')).toBeInTheDocument();
    expect(counters.getAllByText(/Cashier \d/)).toHaveLength(2);
  });

  it('shows the waiting line with real names, positions and "you"', () => {
    render(<ShopFloorView shop={shop()}/>);
    const line = within(screen.getByLabelText('Waiting line (queue)'));
    expect(line.getByText('You (Sadia)')).toBeInTheDocument();
    expect(line.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('You are number 1 in line (estimated).')).toBeInTheDocument();
  });

  it('shows stock left, and a sold-out state with idle cashiers', () => {
    const {rerender} = render(<ShopFloorView shop={shop()}/>);
    expect(screen.getByLabelText('Cones left')).toHaveTextContent('6 / 10');
    rerender(<ShopFloorView shop={shop({stock: {initial: 10, remaining: 0}, counters: [], line: []})}/>);
    expect(screen.getByLabelText('Sold out')).toBeInTheDocument();
    expect(screen.getAllByText('No cones left')).toHaveLength(2);
  });

  it('hides stock when the round was not started by the bridge, and shows crowd load', () => {
    render(<ShopFloorView shop={shop({stock: null, managed: false, queueCapacity: null, line: [], crowd: 3})}/>);
    expect(screen.queryByLabelText('Cones left')).not.toBeInTheDocument();
    expect(screen.getByText('+3 crowd customers from the team')).toBeInTheDocument();
  });

  it('says when your cone is being made', () => {
    expect(youText(shop({counters: [{name: 'Sadia', you: true, waitedMs: 0}], line: []}))).toBe('A cashier is making your cone right now.');
    expect(youText(shop({line: []}))).toBeNull();
  });
});

describe('ShopFloor', () => {
  it('loads the live snapshot from the shop endpoint', async () => {
    const api = vi.fn().mockResolvedValue(shop());
    render(<ShopFloor api={api}/>);
    await waitFor(() => expect(screen.getByText('Inside the parlour')).toBeInTheDocument());
    expect(api).toHaveBeenCalledWith('shop');
  });
});
