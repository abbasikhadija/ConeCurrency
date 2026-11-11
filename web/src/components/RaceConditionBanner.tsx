import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, HelpCircle } from 'lucide-react';

interface RaceConditionBannerProps {
  isDetected: boolean;
  onLearnMore?: () => void;
}

export const RaceConditionBanner: React.FC<RaceConditionBannerProps> = ({
  isDetected,
  onLearnMore,
}) => {
  return (
    <AnimatePresence>
      {isDetected && (
        <motion.div
          className="race-condition-alert"
          role="alert"
          data-testid="race-condition-banner"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="alert-content">
            <div className="alert-icon" aria-hidden="true">
              <AlertOctagon size={22} />
            </div>
            <div className="alert-text">
              <strong>CRITICAL INVARIANT VIOLATION: RACE CONDITION DETECTED!</strong>
              <p>
                Concurrent threads accessed and decremented shared inventory simultaneously without
                proper mutual exclusion lock synchronization, resulting in double-booking or oversold stock.
              </p>
            </div>
          </div>
          {onLearnMore && (
            <button className="alert-btn" onClick={onLearnMore}>
              <HelpCircle size={14} />
              <span>How Mutex Fixes This</span>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

