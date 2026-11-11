import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScoopItem } from '../types/index.js';
import { FLAVOR_COLORS } from '../utils/formatters.js';

interface ConeStageProps {
  scoops: ScoopItem[];
  isSoldOutTriggered?: boolean;
  isBusyTriggered?: boolean;
  isBadTriggered?: boolean;
  isScreenShaking?: boolean;
}

export const ConeStage: React.FC<ConeStageProps> = ({
  scoops,
  isSoldOutTriggered = false,
  isBusyTriggered = false,
  isBadTriggered = false,
  isScreenShaking = false,
}) => {
  // Only display the most recent 6 scoops so stack doesn't clip out of stage
  const visibleScoops = scoops.slice(-6);
  const isTall = visibleScoops.length >= 4;

  return (
    <div
      className={`cone-stage-container ${isScreenShaking ? 'screen-shake' : ''}`}
      role="region"
      aria-label="Ice Cream Cone Visualizer"
    >
      {/* Background sparkling dots */}
      <div className="stage-ambient-dots" aria-hidden="true">
        <span className="dot dot-1" />
        <span className="dot dot-2" />
        <span className="dot dot-3" />
        <span className="dot dot-4" />
      </div>

      {/* Bad Request Warning Bubble */}
      <AnimatePresence>
        {isBadTriggered && (
          <motion.div
            className="bad-request-bubble"
            initial={{ opacity: 0, scale: 0.6, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <span>⚠️</span> MALFORMED PROTOCOL PAYLOAD
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOLD OUT Stamp Banner */}
      <AnimatePresence>
        {isSoldOutTriggered && (
          <motion.div
            className="sold-out-stamp"
            initial={{ opacity: 0, scale: 2.2, rotate: -25 }}
            animate={{ opacity: 1, scale: 1, rotate: -12 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 12 }}
          >
            SOLD OUT
          </motion.div>
        )}
      </AnimatePresence>

      {/* BUSY Queue Bounce Banner */}
      <AnimatePresence>
        {isBusyTriggered && (
          <motion.div
            className="queue-busy-banner"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ duration: 0.25 }}
          >
            🛑 QUEUE OVERFLOW (ERR BUSY)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Melting Puddle on Sold Out */}
      <AnimatePresence>
        {isSoldOutTriggered && (
          <motion.div
            className="melting-puddle"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 0.85 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* The Assembled Cone & Scoop Stack */}
      <motion.div
        className={`cone-assembly ${isTall ? 'cone-wobble' : ''} ${isBadTriggered ? 'cone-shake' : ''}`}
        animate={isTall ? { rotate: [-1.2, 1.2, -1.2] } : {}}
        transition={isTall ? { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } : {}}
      >
        {/* Stack of Scoops */}
        <div className="scoop-stack">
          <AnimatePresence>
            {visibleScoops.map((scoop, index) => {
              const flavor = FLAVOR_COLORS[scoop.flavor];
              const isTop = index === visibleScoops.length - 1;

              return (
                <motion.div
                  key={scoop.id}
                  className={`scoop-wrapper ${scoop.isMelting ? 'scoop-melting' : ''} ${
                    scoop.isBounced ? 'scoop-bounced' : ''
                  }`}
                  initial={{ y: -70, scaleY: 1.3, scaleX: 0.8, opacity: 0 }}
                  animate={{
                    y: 0,
                    scaleY: [1.3, 0.8, 1.05, 1],
                    scaleX: [0.8, 1.2, 0.95, 1],
                    opacity: 1,
                  }}
                  exit={{ y: 80, opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                  style={{
                    backgroundColor: flavor.bg,
                    borderColor: flavor.border,
                    zIndex: index + 2,
                    marginTop: index === 0 ? 0 : -22,
                  }}
                >
                  {/* Flavour texture drip */}
                  <span className="scoop-drip" style={{ backgroundColor: flavor.border }} />

                  {/* Optional Cherry on the very top scoop */}
                  {isTop && visibleScoops.length >= 3 && (
                    <motion.div
                      className="cherry-topper"
                      initial={{ scale: 0, y: -20 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <span className="cherry-stem" />
                      <span className="cherry-ball" />
                    </motion.div>
                  )}

                  {/* Sprinkles on middle scoops */}
                  {scoop.hasSprinkles && (
                    <div className="sprinkles-cluster" aria-hidden="true">
                      <span className="sprinkle sp-1" />
                      <span className="sprinkle sp-2" />
                      <span className="sprinkle sp-3" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Waffle Cone with Crosshatch Texture */}
        <div className="waffle-cone-structure" aria-hidden="true">
          <div className="waffle-cone-triangle">
            <div className="cone-crosshatch" />
          </div>
        </div>
      </motion.div>

      {/* Height / Cones in stack indicator */}
      {visibleScoops.length > 0 && (
        <div className="stack-counter-pill">
          {scoops.length} Cones Scooped 🍨
        </div>
      )}
    </div>
  );
};

