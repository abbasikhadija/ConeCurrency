import React, { useState, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header.js';
import { ParlourCounter } from './components/ParlourCounter.js';
import { RegisterTape } from './components/RegisterTape.js';
import { RaceConditionBanner } from './components/RaceConditionBanner.js';
import { ToastContainer } from './components/ToastContainer.js';
import { KeyboardHelpModal } from './components/KeyboardHelpModal.js';
import { LearnSection } from './learn/LearnSection.js';

import { useWebSocket } from './hooks/useWebSocket.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { soundEngine } from './utils/sound.js';
import { ScoopItem, ToastNotification } from './types/index.js';
import { getFlavorByIndex } from './utils/formatters.js';
import { LearnArticle } from './learn/articles.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'learn'>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Visual animation triggers
  const [scoops, setScoops] = useState<ScoopItem[]>([]);
  const [isSoldOutTriggered, setIsSoldOutTriggered] = useState<boolean>(false);
  const [isBusyTriggered, setIsBusyTriggered] = useState<boolean>(false);
  const [isBadTriggered, setIsBadTriggered] = useState<boolean>(false);
  const [isScreenShaking, setIsScreenShaking] = useState<boolean>(false);

  // In-memory toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const scoopCounterRef = useRef<number>(0);

  const addToast = useCallback((type: ToastNotification['type'], message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, timestamp: Date.now() }]);

    // Auto-dismiss after 4.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const handleTapeEntry = useCallback((entry: any) => {
    if (entry.status === 'OK') {
      scoopCounterRef.current++;
      const newScoop: ScoopItem = {
        id: `scoop_${Date.now()}_${Math.random()}`,
        flavor: getFlavorByIndex(scoopCounterRef.current),
        timestamp: Date.now(),
        hasSprinkles: scoopCounterRef.current % 3 === 0,
      };

      setScoops((prev) => [...prev, newScoop]);
      soundEngine.playScoop();
    } else if (entry.status === 'SOLD_OUT') {
      setIsSoldOutTriggered(true);
      soundEngine.playSoldOut();
      setTimeout(() => setIsSoldOutTriggered(false), 3000);
    } else if (entry.status === 'BUSY') {
      setIsBusyTriggered(true);
      soundEngine.playBusy();
      setTimeout(() => setIsBusyTriggered(false), 2500);
    } else if (entry.status === 'ERR' || entry.status === 'MALFORMED') {
      setIsBadTriggered(true);
      soundEngine.playError();
      setTimeout(() => setIsBadTriggered(false), 2000);
    }
  }, []);

  const handleBackendStatusChange = useCallback(
    (connected: boolean) => {
      if (connected) {
        addToast('success', 'TCP Backend Connected (127.0.0.1:8080)');
      } else {
        addToast('error', 'Backend Unreachable - Make sure C server is running on 127.0.0.1:8080');
      }
    },
    [addToast]
  );

  const {
    connectionStatus,
    backendConnected,
    stats,
    tapeEntries,
    orderOne,
    orderBurst,
    sendBad,
    resetCounters: wsResetCounters,
    clearTape,
  } = useWebSocket({
    onReset: () => {setScoops([]); scoopCounterRef.current = 0; addToast('success', 'Backend confirmed reset');},
    onError: message => addToast('error', message),
    onTapeEntry: handleTapeEntry,
    onBackendStatusChange: handleBackendStatusChange,
  });

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.setEnabled(next);
    if (next) {
      soundEngine.playChime();
      addToast('info', 'Parlour sound effects enabled 🔔');
    }
  };

  const handleResetCounters = () => {
    wsResetCounters();
    addToast('info', 'Requesting backend reset...');
  };

  const handleOrderOne = () => {
    orderOne();
  };

  const handleRushHour = () => {
    orderBurst(10);
    addToast('info', 'Rush Hour: 10 concurrent requests fired!');
  };

  const handleFlashMob = () => {
    orderBurst(25);
    setIsScreenShaking(true);
    setTimeout(() => setIsScreenShaking(false), 800);

    // Blast celebratory confetti!
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF7597', '#82C4A2', '#FFF1CC', '#C68B59', '#684E45'],
    });

    addToast('warning', 'Flash Mob: 25 concurrent connections storming the counter!');
  };

  const handleSendBad = () => {
    sendBad();
  };

  // Keyboard shortcuts integration
  useKeyboardShortcuts({
    onBook: handleOrderOne,
    onRush: handleRushHour,
    onFlashMob: handleFlashMob,
    onClearTape: clearTape,
    onToggleHelp: () => setIsHelpOpen((prev) => !prev),
    disabled: !backendConnected,
  });

  // Handle "Try it" button from Learn Articles
  const handleTriggerLearnAction = (action?: LearnArticle['actionTrigger']) => {
    setActiveTab('dashboard');

    setTimeout(() => {
      switch (action) {
        case 'BOOK':
          handleOrderOne();
          break;
        case 'RUSH':
          handleRushHour();
          break;
        case 'FLASH_MOB':
          handleFlashMob();
          break;
        case 'BAD':
          handleSendBad();
          break;
        case 'RESET':
          handleResetCounters();
          break;
        case 'CLEAR':
          clearTape();
          break;
      }
    }, 250);
  };

  return (
    <div className="parlour-page-wrapper">
      {/* 1. Header Banner */}
      <Header
        connectionStatus={connectionStatus}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenHelp={() => setIsHelpOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* 2. Critical Race Condition Detection Banner */}
      <RaceConditionBanner
        isDetected={stats.raceConditionDetected}
        onLearnMore={() => {
          setActiveTab('learn');
          setTimeout(() => {
            document.getElementById('rush-hour')?.scrollIntoView({ behavior: 'smooth' });
          }, 200);
        }}
      />

      {/* 3. Main Body: Dashboard or Learn View */}
      {activeTab === 'dashboard' ? (
        <main className="dashboard-grid-layout" role="main">
          {/* Left Column: Parlour Counter */}
          <ParlourCounter
            stats={stats}
            scoops={scoops}
            isSoldOutTriggered={isSoldOutTriggered}
            isBusyTriggered={isBusyTriggered}
            isBadTriggered={isBadTriggered}
            isScreenShaking={isScreenShaking}
            onOrderOne={handleOrderOne}
            onRushHour={handleRushHour}
            onFlashMob={handleFlashMob}
            onSendBad={handleSendBad}
            onResetCounters={handleResetCounters}
            backendConnected={backendConnected}
          />

          {/* Right Column: Register Tape */}
          <RegisterTape
            entries={tapeEntries}
            onClear={clearTape}
          />
        </main>
      ) : (
        <LearnSection onTriggerAction={handleTriggerLearnAction} />
      )}

      {/* 4. Footer */}
      <footer className="parlour-footer" role="contentinfo">
        <p>CSC-251L Operating Systems &bull; Admin dashboard</p>
      </footer>

      {/* 5. Toasts and Modals */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <KeyboardHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
};
export default App;

