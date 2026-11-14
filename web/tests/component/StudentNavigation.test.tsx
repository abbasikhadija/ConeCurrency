// Menu, entry choice and About page tests — Sadia Fatima (P3)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentMenu from '../../src/student/StudentMenu';
import EntryChoice from '../../src/student/EntryChoice';
import AboutUs from '../../src/student/AboutUs';

describe('StudentMenu', () => {
  it('opens, runs the chosen item and closes again', () => {
    const admin = vi.fn();
    render(<StudentMenu items={[{label: 'Admin login', onSelect: admin}, {label: 'About us', onSelect: vi.fn()}]}/>);
    const toggle = screen.getByRole('button', {name: '☰ Menu'});
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('menuitem', {name: 'Admin login'}));
    expect(admin).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<StudentMenu items={[{label: 'About us', onSelect: vi.fn()}]}/>);
    fireEvent.click(screen.getByRole('button', {name: '☰ Menu'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('EntryChoice', () => {
  it('offers customer and admin entries', () => {
    const customer = vi.fn(), admin = vi.fn();
    render(<EntryChoice onCustomer={customer} onAdmin={admin}/>);
    fireEvent.click(screen.getByRole('button', {name: /I'm a customer/}));
    fireEvent.click(screen.getByRole('button', {name: /Team admin/}));
    expect(customer).toHaveBeenCalledOnce();
    expect(admin).toHaveBeenCalledOnce();
  });
});

describe('AboutUs', () => {
  it('credits all three team members and shows the copyright', () => {
    const back = vi.fn();
    render(<AboutUs onBack={back}/>);
    for (const name of ['Abdul Qudoos', 'Khadija Abbasi', 'Sadia Fatima']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByText(/© 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Back to the shop'}));
    expect(back).toHaveBeenCalledOnce();
  });
});

import StudentLearn from '../../src/student/StudentLearn';

describe('StudentLearn', () => {
  it('shows the learning articles without dashboard "try it" buttons', () => {
    const back = vi.fn();
    render(<StudentLearn onBack={back}/>);
    expect(screen.getByRole('heading', {name: 'How the parlour works 🍦'})).toBeInTheDocument();
    expect(screen.getByRole('region', {name: /Operating Systems Concurrency Documentation/})).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^btn-try-/)).toHaveLength(0);
    fireEvent.click(screen.getAllByRole('button', {name: 'Back to the shop'})[0]);
    expect(back).toHaveBeenCalledOnce();
  });
});
