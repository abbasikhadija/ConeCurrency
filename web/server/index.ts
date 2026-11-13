import 'dotenv/config';
import { BridgeServer } from './bridge.js';
import { PROTOCOL_CONFIG } from '../src/config/protocol.js';

const bridgePort = parseInt(process.env.BRIDGE_PORT || String(PROTOCOL_CONFIG.DEFAULT_BRIDGE_PORT), 10);
const backendHost = process.env.BACKEND_HOST || PROTOCOL_CONFIG.DEFAULT_BACKEND_HOST;
const backendPort = parseInt(process.env.BACKEND_PORT || String(PROTOCOL_CONFIG.DEFAULT_BACKEND_PORT), 10);

const bridge = new BridgeServer({
  manageBackend: process.env.MANAGE_BACKEND === '1',
  serverPath: process.env.C_SERVER_PATH,
  initialStock: process.env.BACKEND_STOCK ? Number(process.env.BACKEND_STOCK) : undefined,
  bridgePort,
  backendHost,
  backendPort,
});

bridge.start().catch((err) => {
  console.error('[Bridge Server] Error starting:', err);
  process.exit(1);
});

const shutdown = async () => {
  console.log('\n[Bridge Server] Shutting down...');
  await bridge.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

