import { MockTcpServer } from './tcp-server.js';
import { PROTOCOL_CONFIG } from '../src/config/protocol.js';

const port = parseInt(process.env.BACKEND_PORT || String(PROTOCOL_CONFIG.DEFAULT_BACKEND_PORT), 10);
const host = process.env.BACKEND_HOST || PROTOCOL_CONFIG.DEFAULT_BACKEND_HOST;
const stock = parseInt(process.env.STOCK || '50', 10);
const unsafe = process.env.MOCK_UNSAFE === 'true';

const server = new MockTcpServer({
  port,
  host,
  stock,
  allowRaceCondition: unsafe,
});

server.start().catch((err) => {
  console.error('[Mock Server] Failed to start:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n[Mock Server] Shutting down...');
  await server.stop();
  process.exit(0);
});

