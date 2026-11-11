import React from 'react';

interface DiagramComponentProps {
  type: 'book' | 'concurrency' | 'soldout' | 'queue' | 'bad' | 'latency' | 'reset' | 'tape';
}

export const DiagramComponent: React.FC<DiagramComponentProps> = ({ type }) => {
  switch (type) {
    case 'book':
      return (
        <div className="diagram-box">
          <svg viewBox="0 0 760 140" className="diagram-svg" aria-label="Single Request Lifecycle Sequence Diagram">
            {/* Steps */}
            <rect x="20" y="45" width="100" height="50" rx="8" fill="#FFF1CC" stroke="#C68B59" strokeWidth="2" />
            <text x="70" y="75" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#402E2A">React UI</text>

            <path d="M 120 70 L 190 70" stroke="#C68B59" strokeWidth="2" markerEnd="url(#arrow)" />
            <text x="155" y="60" textAnchor="middle" fontSize="9" fill="#888">WebSocket</text>

            <rect x="190" y="45" width="110" height="50" rx="8" fill="#E8F4F8" stroke="#3182CE" strokeWidth="2" />
            <text x="245" y="75" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1A365D">Node Bridge</text>

            <path d="M 300 70 L 370 70" stroke="#3182CE" strokeWidth="2" markerEnd="url(#arrow)" />
            <text x="335" y="60" textAnchor="middle" fontSize="9" fill="#888">Raw TCP</text>

            <rect x="370" y="45" width="110" height="50" rx="8" fill="#F0FFF4" stroke="#38A169" strokeWidth="2" />
            <text x="425" y="75" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#22543D">Accept Loop</text>

            <path d="M 480 70 L 540 70" stroke="#38A169" strokeWidth="2" markerEnd="url(#arrow)" />
            <text x="510" y="60" textAnchor="middle" fontSize="9" fill="#888">queue_push</text>

            <rect x="540" y="45" width="90" height="50" rx="8" fill="#FAF5EB" stroke="#8C5326" strokeWidth="2" />
            <text x="585" y="75" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#8C5326">Worker Pool</text>

            <path d="M 630 70 L 680 70" stroke="#8C5326" strokeWidth="2" markerEnd="url(#arrow)" />

            <rect x="680" y="45" width="60" height="50" rx="8" fill="#FED7D7" stroke="#E53E3E" strokeWidth="2" />
            <text x="710" y="70" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#9B2C2C">Mutex</text>
            <text x="710" y="85" textAnchor="middle" fontSize="9" fill="#9B2C2C">stock--</text>

            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8C5326" />
              </marker>
            </defs>
          </svg>
        </div>
      );

    case 'concurrency':
      return (
        <div className="diagram-box">
          <div className="concurrency-visualizer">
            <div className="visualizer-lane">
              <span className="lane-label">Worker 1</span>
              <div className="lane-bar safe">pthread_mutex_lock() &bull; remaining = 49 &bull; unlock()</div>
            </div>
            <div className="visualizer-lane">
              <span className="lane-label">Worker 2</span>
              <div className="lane-bar waiting">[ BLOCKED: Waiting for Mutex ]</div>
              <div className="lane-bar safe">Acquires lock &bull; remaining = 48 &bull; unlock()</div>
            </div>
            <div className="visualizer-lane">
              <span className="lane-label">Worker 3</span>
              <div className="lane-bar waiting">[ BLOCKED: Waiting for Mutex ]</div>
              <div className="lane-bar safe">Acquires lock &bull; remaining = 47 &bull; unlock()</div>
            </div>
          </div>
        </div>
      );

    case 'queue':
      return (
        <div className="diagram-box">
          <div className="queue-slots-diagram">
            <div className="queue-header">Bounded FIFO Array (Capacity: 8 Client Sockets)</div>
            <div className="slots-row">
              <div className="slot occupied">fd 4</div>
              <div className="slot occupied">fd 5</div>
              <div className="slot occupied">fd 6</div>
              <div className="slot occupied">fd 7</div>
              <div className="slot empty">[Empty]</div>
              <div className="slot empty">[Empty]</div>
              <div className="slot empty">[Empty]</div>
              <div className="slot empty">[Empty]</div>
            </div>
            <div className="queue-legend">
              <span className="legend-item"><span className="legend-dot occupied" /> Queued Connections</span>
              <span className="legend-item"><span className="legend-dot empty" /> Available Capacity</span>
              <span className="legend-item"><span className="legend-dot full" /> When 8/8 full &rarr; BUSY Reply</span>
            </div>
          </div>
        </div>
      );

    case 'soldout':
      return (
        <div className="diagram-box">
          <div className="soldout-depletion-diagram">
            <div className="depletion-bar-container">
              <div className="depletion-fill" style={{ width: '0%' }} />
              <span className="depletion-text">Inventory: 0 / 50 Cones Remaining</span>
            </div>
            <div className="depletion-arrow">&darr; Next Request &darr;</div>
            <div className="depletion-result">if (remaining &gt; 0) &rarr; FALSE &rarr; Return ERR SOLD_OUT</div>
          </div>
        </div>
      );

    case 'latency':
      return (
        <div className="diagram-box">
          <div className="latency-breakdown-timeline">
            <div className="timeline-segment net" style={{ width: '25%' }}>Network (2ms)</div>
            <div className="timeline-segment work" style={{ width: '45%' }}>Simulated Work (20ms)</div>
            <div className="timeline-segment mutex" style={{ width: '30%' }}>Queue &amp; Lock Wait (14ms)</div>
          </div>
          <div className="timeline-total">Total Round-Trip Latency: 36.0 ms</div>
        </div>
      );

    default:
      return (
        <div className="diagram-box">
          <div className="generic-flow-diagram">
            <span>Client &bull; BOOK &rarr; [ Mutex Critical Section ] &rarr; OK Reply &bull; Client</span>
          </div>
        </div>
      );
  }
};

