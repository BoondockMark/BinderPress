import { CONTENT_ROOT, contentMode } from './lib/project-config.mjs';
import { createEditorServer } from './lib/editor-server.mjs';

const root = CONTENT_ROOT;
const server = await createEditorServer({ root, ...contentMode() });
server.listen(4174, '127.0.0.1', () => console.log('Handout editor: http://127.0.0.1:4174'));
