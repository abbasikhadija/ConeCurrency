// Types a list of lines one character at a time — Sadia Fatima
import { useEffect, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Returns how many characters of each line are visible, which line is being
 * typed, and a way to reveal everything at once. Reduced-motion users see
 * everything immediately.
 */
export function useTypewriter(lines: string[], msPerChar = 16) {
  const [line, setLine] = useState(() => (prefersReducedMotion() ? lines.length : 0));
  const [chars, setChars] = useState(0);
  const done = line >= lines.length;
  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => {
      if (chars < lines[line].length) setChars(chars + 1);
      else { setLine(line + 1); setChars(0); }
    }, chars < lines[line].length ? msPerChar : msPerChar * 12);   // short pause between lines
    return () => clearTimeout(timer);
  }, [line, chars, done, lines, msPerChar]);
  const visible = (index: number) => (index < line ? lines[index] : index === line ? lines[index].slice(0, chars) : '');
  const finished = (index: number) => index < line;
  return {visible, finished, typing: line, done, revealAll: () => setLine(lines.length)};
}
