import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onBook: () => void;
  onRush: () => void;
  onFlashMob: () => void;
  onClearTape: () => void;
  onToggleHelp: () => void;
  disabled?: boolean;
}

export function useKeyboardShortcuts({
  onBook,
  onRush,
  onFlashMob,
  onClearTape,
  onToggleHelp,
  disabled = false,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Do not trigger if typing in an input or textarea
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key.toUpperCase();

      if (key === 'B') {
        event.preventDefault();
        onBook();
      } else if (key === 'R') {
        event.preventDefault();
        onRush();
      } else if (key === 'F') {
        event.preventDefault();
        onFlashMob();
      } else if (key === 'C') {
        event.preventDefault();
        onClearTape();
      } else if (key === '?' || event.key === '/') {
        event.preventDefault();
        onToggleHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBook, onRush, onFlashMob, onClearTape, onToggleHelp, disabled]);
}

