import { CONTENT_ROOT, APP_ROOT } from './lib/project-config.mjs';
import path from 'node:path';
import { linkPrivateCheckout } from './lib/local-setup.mjs';

const root = CONTENT_ROOT;
console.log(await linkPrivateCheckout(root));
