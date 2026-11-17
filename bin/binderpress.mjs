#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const command = args.shift();
if (!command || ['help', '--help', '-h'].includes(command)) {
  console.log(`BinderPress — reviewed, print-ready handbooks and binders

Usage: binderpress <command> [--content <directory>] [options]

  init <directory>  Create an independent starter content folder
  editor            Open the local visual editor at http://127.0.0.1:4174
  build             Validate and generate PDFs, previews, and indexes
  check             Verify committed PDFs and indexes without changing them
  lint:layout       Check print geometry, optionally followed by handout codes
  preview <CODE>    Serve previously built handout HTML
  setup:private     Link the private sibling specified in the content config

Build/editor accept --public or --private. Private content stays in its checkout.
The content directory defaults to the current folder; this application's root
uses examples/starter. Requires Node.js 22+ and npm ci in the application repo.`);
  process.exit(0);
}
const contentIndex = args.indexOf('--content');
if (contentIndex !== -1) {
  const directory = args[contentIndex + 1];
  if (!directory || directory.startsWith('--')) throw Error('--content requires a directory');
  process.env.BINDERPRESS_CONTENT_DIR = path.resolve(directory);
  args.splice(contentIndex, 2);
}
if (command === 'init') {
  if (args.length !== 1 || args[0].startsWith('-')) throw Error('Usage: binderpress init <new-directory>');
  const destination = path.resolve(args[0]);
  // Refuse existing paths, including symlinks, so initialization never overwrites content.
  await fs.mkdir(destination);
  const starter = fileURLToPath(new URL('../examples/starter/', import.meta.url));
  const include = new Set(['binderpress.config.json', 'handouts', 'README.md']);
  try {
    for (const name of include) await fs.cp(path.join(starter, name), path.join(destination, name), { recursive: true, force: false, errorOnExist: true });
  } catch (error) {
    throw Error(`Could not finish initialization in ${destination}: ${error.message}`);
  }
  console.log(`Created ${destination}. Run binderpress editor --content ${JSON.stringify(destination)}`);
} else {
  const scripts = { editor: 'editor', build: 'build', check: 'build', 'lint:layout': 'lint-layout', preview: 'preview', 'setup:private': 'setup' };
  if (!scripts[command]) throw Error(`Unknown command: ${command}. Run binderpress --help.`);
  process.argv = [process.execPath, fileURLToPath(import.meta.url), ...args, ...(command === 'check' ? ['--check'] : [])];
  await import(`../scripts/${scripts[command]}.mjs`);
}
