// StudentView tests — Sadia Fatima (P3)
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudentView, { shopModeText, orderMessage, StudentState } from '../../src/student/StudentView';

const base: StudentState = {name: 'Sadia', round: 3, mode: 'concurrent', workers: 4, managed: true};
const props = (student: StudentState | null) => ({student, setStudent: vi.fn(), name: '', setName: vi.fn(), sending: false, act: vi.fn(), api: vi.fn()});

describe('StudentView', () => {
  it('describes the shop mode in plain language', () => {
    expect(shopModeText(base)).toBe('4 cashiers are serving customers at the same time.');
    expect(shopModeText({...base, mode: 'sequential'})).toBe('One cashier is serving customers one at a time.');
    expect(shopModeText({...base, managed: false})).toBe('The shop is open.');
  });

  it('does not show internal round numbers or developer notes', () => {
    render(<StudentView {...props(base)}/>);
    expect(screen.getByRole('heading', {name: 'Hello, Sadia!'})).toBeInTheDocument();
    expect(screen.queryByText(/Round \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/decorative/)).not.toBeInTheDocument();
    expect(screen.getByText('4 cashiers are serving customers at the same time.')).toBeInTheDocument();
  });

  it('maps every server reply to a clear message', () => {
    expect(orderMessage()).toBe('Ready to order.');
    expect(orderMessage({id: '1', round: 1, state: 'pending'})).toMatch(/pending/);
    expect(orderMessage({id: '1', round: 1, state: 'complete', result: {status: 'OK'}})).toBe('Your ice cream is ready!');
    expect(orderMessage({id: '1', round: 1, state: 'complete', result: {status: 'SOLD_OUT'}})).toBe('This round is sold out.');
    expect(orderMessage({id: '1', round: 1, state: 'complete', result: {status: 'BUSY'}})).toMatch(/queue is full/);
  });

  it('disables ordering and leaving while an order is pending', () => {
    render(<StudentView {...props({...base, order: {id: '1', round: 1, state: 'pending'}})}/>);
    expect(screen.getByRole('button', {name: 'Order one ice cream'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Leave shop'})).toBeDisabled();
  });
});

describe('Welcome form', () => {
  it('puts the label above the input and uses the parlour wording', () => {
    render(<StudentView {...props(null)}/>);
    const input = screen.getByLabelText('Your display name');
    const label = screen.getByText('Your display name');
    expect(label.tagName).toBe('LABEL');
    expect(label.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Enter the parlour'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Join the shop'})).not.toBeInTheDocument();
    expect(screen.getByText(/Classmates will see this name/)).toBeInTheDocument();
  });
});
