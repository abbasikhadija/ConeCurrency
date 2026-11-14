// StudentView tests — Sadia Fatima (P3)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentView, { shopModeText, orderMessage, StudentState } from '../../src/student/StudentView';

const base: StudentState = {name: 'Sadia', round: 3, mode: 'concurrent', workers: 4, managed: true};
// The shop floor polls the api; a never-settling promise keeps these tests focused on StudentView itself.
const props = (student: StudentState | null) => ({student, setStudent: vi.fn(), name: '', setName: vi.fn(), sending: false, act: vi.fn(), api: vi.fn(() => new Promise<any>(() => {}))});

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
    expect(screen.getByRole('button', {name: 'Order another ice cream'})).toBeDisabled();
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
    expect(screen.getByText(/Other customers will see this name/)).toBeInTheDocument();
  });
});

describe('Parlour front', () => {
  it('shows the decorative shop on the welcome screen only', () => {
    const {unmount} = render(<StudentView {...props(null)}/>);
    const front = screen.getByTestId('parlour-front');
    expect(front).toHaveAttribute('aria-hidden', 'true');   // decorative: hidden from screen readers
    unmount();
    render(<StudentView {...props(base)}/>);
    expect(screen.queryByTestId('parlour-front')).not.toBeInTheDocument();
  });
});

vi.mock('canvas-confetti', () => ({default: vi.fn()}));
import confetti from 'canvas-confetti';

describe('Order picture and celebration', () => {
  const pending: StudentState = {...base, order: {id: 'o1', round: 1, state: 'pending'}};
  const served: StudentState = {...base, order: {id: 'o1', round: 1, state: 'complete', result: {status: 'OK'}}};

  it('shows distinct pictures for pending, sold out and busy', () => {
    const {rerender} = render(<StudentView {...props(pending)}/>);
    expect(screen.getByLabelText('Your cone is being made')).toBeInTheDocument();
    rerender(<StudentView {...props({...base, order: {id: 'o2', round: 1, state: 'complete', result: {status: 'SOLD_OUT'}}})}/>);
    expect(screen.getByLabelText('Sold out')).toHaveTextContent('SOLD OUT');
    rerender(<StudentView {...props({...base, order: {id: 'o3', round: 1, state: 'complete', result: {status: 'BUSY'}}})}/>);
    expect(screen.getByLabelText('Shop busy')).toBeInTheDocument();
  });

  it('celebrates with confetti when this screen sees the order get served, and offers How it works', () => {
    vi.mocked(confetti).mockClear();
    const onLearn = vi.fn();
    const {rerender} = render(<StudentView {...props(pending)} onLearn={onLearn}/>);
    rerender(<StudentView {...props(served)} onLearn={onLearn}/>);
    expect(screen.getByRole('dialog', {name: /Yay! Your ice cream is ready/})).toBeInTheDocument();
    expect(confetti).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Yes, show me how it works'}));
    expect(onLearn).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not celebrate an old result shown again after a reload', () => {
    vi.mocked(confetti).mockClear();
    render(<StudentView {...props(served)}/>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(confetti).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Order another ice cream'})).toBeInTheDocument();
  });

  it('"Maybe later" closes the pop-up', () => {
    const {rerender} = render(<StudentView {...props(pending)}/>);
    rerender(<StudentView {...props(served)}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Maybe later'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
