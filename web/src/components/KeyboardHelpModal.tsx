import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <motion.div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <Keyboard size={18} />
                <h3 id="modal-title">Keyboard Shortcuts</h3>
              </div>
              <button className="modal-close-btn" onClick={onClose} aria-label="Close shortcuts modal">
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="shortcut-row">
                <span className="shortcut-desc">Order 1 Cone (BOOK)</span>
                <kbd className="shortcut-key">B</kbd>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Rush Hour (10 Cones)</span>
                <kbd className="shortcut-key">R</kbd>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Flash Mob (25 Cones)</span>
                <kbd className="shortcut-key">F</kbd>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Clear Register Tape</span>
                <kbd className="shortcut-key">C</kbd>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Toggle Shortcuts Help</span>
                <kbd className="shortcut-key">?</kbd>
              </div>
            </div>

            <div className="modal-footer">
              Press <kbd>Esc</kbd> or click outside to dismiss.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

