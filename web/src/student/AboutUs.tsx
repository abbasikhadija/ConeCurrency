// About page — Sadia Fatima
import React from 'react';

const TEAM = ['Sadia Fatima', 'Abdul Qudoos', 'Khadija Abbasi'];

const INSIDE = [
  {title: 'Threads', text: 'A fixed team of POSIX worker threads, the cashiers, serves customers at the same time.'},
  {title: 'Bounded queue', text: 'Customers who arrive while every cashier is busy wait in a first-come, first-served line with limited room.'},
  {title: 'Mutual exclusion', text: 'A mutex lets only one cashier open the freezer at a time, so the last cone can never be sold twice.'},
  {title: 'Condition variables', text: 'Idle cashiers sleep instead of spinning and wake up the moment a customer arrives.'},
  {title: 'Load shedding', text: 'When the line is full, new customers are told "the line is full" right away instead of waiting forever.'},
  {title: 'Sockets and system calls', text: 'Every order is a real TCP connection to a C server on Linux, handled with socket, accept, read and write.'},
  {title: 'Sequential vs concurrent', text: 'The same shop can run with one cashier or many, so the speed difference can be measured.'},
  {title: 'Clean shutdown', text: 'On closing, the server finishes its customers, wakes every cashier and waits for all of them before exiting.'},
];

export default function AboutUs({onBack}: {onBack: () => void}) {
  return <section className="about-us" aria-labelledby="about-title">
    <h1 id="about-title">About ConeCurrency 🍦</h1>
    <p className="about-vision">
      <strong>Our vision:</strong> make operating-system concepts you can <em>see</em>. Every cone in this
      parlour is a real request to a C server on Linux. When many customers order at once, the server's
      threads, waiting queue and locks decide who is served, in what order, and that nobody gets a cone
      that doesn't exist.
    </p>
    <h2>The team</h2>
    <ul className="about-team about-names">
      {TEAM.map(name => <li key={name}><strong>{name}</strong></li>)}
    </ul>
    <h2>What's inside</h2>
    <p>ConeCurrency is an Operating Systems project. The ice cream parlour is a real concurrent server, and each part of
      the shop shows an operating-system idea:</p>
    <ul className="about-inside">
      {INSIDE.map(item => <li key={item.title}><strong>{item.title}</strong><p>{item.text}</p></li>)}
    </ul>
    <h2>The project</h2>
    <p>CSC-251L Operating Systems Lab, Fall 2026 — Section G, Sukkur IBA University.
      Built with C, POSIX threads, Linux TCP sockets, Node.js and React.</p>
    <p className="about-copyright">© 2026 Sadia Fatima, Abdul Qudoos and Khadija Abbasi. All rights reserved.</p>
    <button type="button" onClick={onBack}>Back to the shop</button>
  </section>;
}
