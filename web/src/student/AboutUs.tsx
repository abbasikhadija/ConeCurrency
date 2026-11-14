// About page — Sadia Fatima (P3)
import React from 'react';

const TEAM = [
  {name: 'Abdul Qudoos', role: 'P1 — Synchronization', work: 'Booking engine with POSIX mutex, thread-safe statistics, load tester, race-condition proof; GUI: gelateria dashboard and Python/desktop interfaces'},
  {name: 'Khadija Abbasi', role: 'P2 — Networking & integration', work: 'TCP server, request handler, sequential mode, command-line options, benchmarks, classroom web bridge'},
  {name: 'Sadia Fatima', role: 'P3 — Threads & scheduling', work: 'Bounded queue, worker thread pool, concurrent accept loop and clean shutdown; GUI: classroom student interface and live shop floor'},
];

export default function AboutUs({onBack}: {onBack: () => void}) {
  return <section className="about-us" aria-labelledby="about-title">
    <h1 id="about-title">About ConeCurrency 🍦</h1>
    <p className="about-vision">
      <strong>Our vision:</strong> make operating-system concepts you can <em>see</em>. Every cone in this
      parlour is a real request to a C server on Linux. When the whole class orders at once, the server's
      threads, waiting queue and locks decide who is served, in what order, and that nobody gets a cone
      that doesn't exist.
    </p>
    <h2>The team</h2>
    <ul className="about-team">
      {TEAM.map(member => <li key={member.name}>
        <strong>{member.name}</strong> <span className="about-role">{member.role}</span>
        <p>{member.work}</p>
      </li>)}
    </ul>
    <h2>The project</h2>
    <p>CSC-251L Operating Systems Lab, Fall 2026 — Section G, Sukkur IBA University.
      Built with C, POSIX threads, Linux TCP sockets, Node.js and React.</p>
    <p className="about-copyright">© 2026 Abdul Qudoos, Khadija Abbasi and Sadia Fatima. All rights reserved.</p>
    <button type="button" onClick={onBack}>Back to the shop</button>
  </section>;
}
