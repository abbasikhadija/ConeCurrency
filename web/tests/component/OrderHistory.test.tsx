// Order history and served-time tests — Sadia Fatima (P3)
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import OrderHistory, { servedTimeText } from '../../src/student/OrderHistory';

const done = (id: string, status: string, latencyMs: number) => ({id, round: 1, state: 'complete' as const, finishedAt: 0, result: {status, latencyMs}});

describe('servedTimeText', () => {
  it('splits measured time into preparation and waiting in line', () => {
    expect(servedTimeText(done('a', 'OK', 1500), 500)).toBe('Served in 1.5 s: making a cone takes 0.5 s, and about 1.0 s was spent waiting in line for a free cashier.');
  });
  it('says a cashier was free when there was no real wait', () => {
    expect(servedTimeText(done('a', 'OK', 540), 500)).toBe('Served in 0.5 s — a cashier was free straight away.');
  });
  it('reports answer time for sold out and nothing while pending', () => {
    expect(servedTimeText(done('a', 'SOLD_OUT', 800), 500)).toBe('The server answered in 0.8 s.');
    expect(servedTimeText({id: 'p', round: 1, state: 'pending'}, 500)).toBeNull();
    expect(servedTimeText(undefined, 500)).toBeNull();
  });
});

describe('OrderHistory', () => {
  it('shows totals and one row per order, newest first', () => {
    render(<OrderHistory history={[done('3', 'SOLD_OUT', 900), done('2', 'OK', 1200), done('1', 'OK', 600)]}/>);
    const totals = screen.getByText(/Served:/).parentElement!;
    expect(within(totals).getByText('2')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Sold out');
    expect(rows[1]).toHaveTextContent('Served');
  });
  it('renders nothing before the first order', () => {
    const {container} = render(<OrderHistory history={[]}/>);
    expect(container).toBeEmptyDOMElement();
  });
});
