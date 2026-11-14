// Customer guide tests — Sadia Fatima
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomerGuide from '../../src/student/CustomerGuide';
import StudentView from '../../src/student/StudentView';
import EntryChoice from '../../src/student/EntryChoice';

describe('CustomerGuide', () => {
  it('opens a guide that explains the background and every message', () => {
    render(<CustomerGuide/>);
    fireEvent.click(screen.getByRole('button', {name: "❓ What's happening here?"}));
    const dialog = screen.getByRole('dialog', {name: /What's happening here/});
    expect(dialog).toHaveTextContent('Operating Systems experiment');
    expect(dialog).toHaveTextContent('worker threads');
    for (const message of ['Ready to order.', 'Your ice cream is ready!', 'This round is sold out.', 'The line is full right now.'])
      expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('closes with the button and with Escape', () => {
    render(<CustomerGuide/>);
    fireEvent.click(screen.getByRole('button', {name: "❓ What's happening here?"}));
    fireEvent.click(screen.getByRole('button', {name: "Got it, let's order"}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: "❓ What's happening here?"}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is offered on the name screen and the first choice screen', () => {
    const {unmount} = render(<StudentView student={null} setStudent={vi.fn()} name="" setName={vi.fn()} sending={false} act={vi.fn()} api={vi.fn()}/>);
    expect(screen.getByRole('button', {name: "❓ What's happening here?"})).toBeInTheDocument();
    unmount();
    render(<EntryChoice onCustomer={vi.fn()} onAdmin={vi.fn()}/>);
    expect(screen.getByRole('button', {name: "❓ What's happening here?"})).toBeInTheDocument();
  });
});
