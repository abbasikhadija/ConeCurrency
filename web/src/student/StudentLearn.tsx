// Read-only "How it works" for students — Sadia Fatima (P3)
import React from 'react';
import { LearnSection } from '../learn/LearnSection.js';

export default function StudentLearn({onBack}: {onBack: () => void}) {
  return <section className="student-learn" aria-labelledby="student-learn-title">
    <div className="student-learn-head">
      <div>
        <h1 id="student-learn-title">How the parlour works 🍦</h1>
        <p>Every order you place travels to a real C server. These pages explain the operating-system ideas behind it:
          threads, the waiting queue, locks and what happens when the shop gets busy.</p>
      </div>
      <button type="button" onClick={onBack}>Back to the shop</button>
    </div>
    <LearnSection/>
  </section>;
}
