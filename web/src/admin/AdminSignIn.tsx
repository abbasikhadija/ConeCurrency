// Owner sign-in — Sadia Fatima
import React from 'react';

type Props = {
  password: string;
  setPassword: (value: string) => void;
  sending: boolean;
  onSubmit: () => void;
  onBack: () => void;
};

export default function AdminSignIn({password, setPassword, sending, onSubmit, onBack}: Props) {
  return <section className="admin-signin" aria-labelledby="admin-signin-title">
    <div className="admin-signin-badge" aria-hidden="true">🔐</div>
    <p className="admin-signin-kicker">Owner's office</p>
    <h1 id="admin-signin-title">Welcome back, owner</h1>
    <p className="admin-signin-lead">The cashiers are lined up and the freezer is stocked. Sign in to plan today's shift
      and watch the server serve your customers.</p>
    <form className="admin-signin-form" onSubmit={event => {event.preventDefault(); onSubmit();}}>
      <label htmlFor="admin-password">Admin password</label>
      <input id="admin-password" type="password" autoComplete="current-password" required value={password}
        onChange={event => setPassword(event.target.value)}/>
      <button disabled={sending}>Sign in</button>
    </form>
    <button type="button" className="admin-signin-back" onClick={onBack}>← Back to the parlour</button>
  </section>;
}
