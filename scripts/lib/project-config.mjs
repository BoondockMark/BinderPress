import { readConfig } from './config-schema.mjs';
export { readConfig, validateConfig } from './config-schema.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CONTENT_ROOT = path.resolve(process.env.BINDERPRESS_CONTENT_DIR || (
  path.resolve(process.cwd()) === path.resolve(APP_ROOT)
    ? path.join(APP_ROOT, 'examples/starter') : process.cwd()
));

export function contentMode(root = CONTENT_ROOT, args = process.argv.slice(2)) {
  const requirePrivate = args.includes('--private');
  const starter = path.resolve(root) === path.resolve(APP_ROOT, 'examples/starter');
  return {
    publicOnly: args.includes('--public') || (starter && !requirePrivate),
    requirePrivate
  };
}

export const CONFIG = readConfig(process.env.BINDERPRESS_CONFIG || path.join(CONTENT_ROOT, 'binderpress.config.json'));
