// "Yay, you got your ice cream!" pop-up with confetti — Sadia Fatima (P3)
import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

type Props = { onLearn?: () => void; onClose: () => void };

export default function Celebration({onLearn, onClose}: Props) {
  const laterButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Two bursts from the sides in parlour colours; skipped for reduced-motion users.
    const colors = ['#e75480', '#f4a6bd', '#9fd8bf', '#fbe7a1', '#b98a6b'];
    void confetti({particleCount: 90, spread: 70, angle: 60, origin: {x: 0, y: .7}, colors, disableForReducedMotion: true});
    void confetti({particleCount: 90, spread: 70, angle: 120, origin: {x: 1, y: .7}, colors, disableForReducedMotion: true});
    laterButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="celebration-backdrop" onClick={onClose}>
    <div className="celebration" role="dialog" aria-modal="true" aria-labelledby="celebration-title" onClick={event => event.stopPropagation()}>
      <div className="celebration-cone" aria-hidden="true">🍦</div>
      <h2 id="celebration-title">Yay! Your ice cream is ready! 🎉</h2>
      <p>A real server thread just made your cone. Want to learn how it works while you enjoy it?</p>
      <div className="celebration-actions">
        {onLearn && <button type="button" onClick={() => { onClose(); onLearn(); }}>Yes, show me how it works</button>}
        <button type="button" ref={laterButton} className="student-leave" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  </div>;
}
