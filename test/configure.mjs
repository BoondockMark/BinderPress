import { fileURLToPath } from 'node:url';
process.env.BINDERPRESS_CONFIG = fileURLToPath(new URL('./fixtures/binderpress.config.json', import.meta.url));
