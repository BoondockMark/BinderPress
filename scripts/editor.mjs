import { CONTENT_ROOT, APP_ROOT } from './lib/project-config.mjs';
import path from 'node:path';
import { createEditorServer } from './lib/editor-server.mjs';

const root = CONTENT_ROOT;
const server = await createEditorServer({ root, publicOnly: process.argv.includes('--public'), requirePrivate: process.argv.includes('--private') });
server.listen(4174, '127.0.0.1', () => console.log('Handout editor: http://127.0.0.1:4174'));
