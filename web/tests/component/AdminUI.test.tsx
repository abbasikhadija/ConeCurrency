// Admin interface tests — Sadia Fatima
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminSignIn from '../../src/admin/AdminSignIn';
import CustomerList, { customerState } from '../../src/admin/CustomerList';
import AboutUs from '../../src/student/AboutUs';

describe('AdminSignIn', () => {
  it('welcomes the owner, labels the password and submits', () => {
    const submit = vi.fn(), back = vi.fn();
    render(<AdminSignIn password="" setPassword={vi.fn()} sending={false} onSubmit={submit} onBack={back}/>);
    expect(screen.getByRole('heading', {name: 'Welcome back, owner'})).toBeInTheDocument();
    expect(screen.getByLabelText('Admin password')).toHaveAttribute('type', 'password');
    fireEvent.submit(screen.getByRole('button', {name: 'Sign in'}).closest('form')!);
    expect(submit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', {name: '← Back to the parlour'}));
    expect(back).toHaveBeenCalledOnce();
  });
});

describe('CustomerList', () => {
  it('is titled Customers and shows each customer with a readable state', () => {
    render(<CustomerList customers={[
      {name: 'Ali', order: {state: 'pending'}},
      {name: 'Zoya', order: {state: 'complete', result: {status: 'OK'}}},
      {name: 'Omar'},
    ]}/>);
    expect(screen.getByRole('heading', {name: 'Customers'})).toBeInTheDocument();
    expect(screen.queryByText(/Classroom orders/)).not.toBeInTheDocument();
    expect(screen.getByText('being served')).toBeInTheDocument();
    expect(screen.getByText('served 🍦')).toBeInTheDocument();
    expect(screen.getByText('browsing')).toBeInTheDocument();
  });
  it('maps sold out and busy replies', () => {
    expect(customerState({name: 'a', order: {state: 'complete', result: {status: 'SOLD_OUT'}}}).label).toBe('sold out');
    expect(customerState({name: 'a', order: {state: 'complete', result: {status: 'BUSY'}}}).label).toBe('line full');
  });
  it('says when nobody has come in yet', () => {
    render(<CustomerList customers={[]}/>);
    expect(screen.getByText('No customers have come in yet.')).toBeInTheDocument();
  });
});

describe('No team-part labels on screen', () => {
  it('About us lists names and work without P1/P2/P3', () => {
    const {container} = render(<AboutUs onBack={vi.fn()}/>);
    expect(container.textContent).not.toMatch(/\bP[123]\b|Person 1/);
  });
});
