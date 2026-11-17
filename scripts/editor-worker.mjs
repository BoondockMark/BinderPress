import { CONFIG, CONTENT_ROOT, contentMode } from './lib/project-config.mjs';
import { createEditorServer } from './lib/editor-server.mjs';

try {
  const server = await createEditorServer({ root: CONTENT_ROOT, ...contentMode(), launcher: true, firstRun: process.env.BINDERPRESS_FIRST_RUN === '1', workspaceId: process.env.BINDERPRESS_WORKSPACE_ID });
  server.listen(0, '127.0.0.1', () => process.send?.({ type: 'ready', port: server.address().port, root: CONTENT_ROOT, title: CONFIG.title }));
  let closing = false;
  const stop = () => {
    if (closing) return; closing = true;
    server.closeAllConnections();
    server.close(() => { if (process.connected) process.disconnect(); });
  };
  process.on('SIGTERM', stop);
  process.on('disconnect', stop);
  process.on('message', message => { if (message?.type === 'shutdown') stop(); });
} catch (error) {
  process.send?.({ type: 'error', message: error.message });
  if (process.connected) process.disconnect();
  process.exitCode = 1;
}
