import { createWelcomeServer } from './lib/welcome-server.mjs';

const server = createWelcomeServer();
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'BinderPress is already using port 4174. Open http://127.0.0.1:4174 or stop the other instance with Ctrl+C.' : error.message);
  process.exitCode = 1;
});
server.listen(4174, '127.0.0.1', () => console.log('Welcome to BinderPress: http://127.0.0.1:4174\nKeep this terminal open. Press Ctrl+C to stop.'));
const stop = async () => { await server.closeEditors(); server.closeAllConnections(); server.close(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
