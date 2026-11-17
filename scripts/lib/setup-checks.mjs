import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';

const versionOf = command => new Promise(resolve => {
  execFile(command, ['--version'], { timeout: 3000, maxBuffer: 2048, windowsHide: true }, (error, stdout) => {
    const version = stdout?.match(command === 'git' ? /^git version [\d.]+/ : /^gh version [\d.]+/)?.[0];
    resolve(error ? null : version || 'Installed');
  });
});
const browserLocation = async () => (await import('puppeteer')).default.executablePath();

export async function inspectSetup({ directory, nodeVersion = process.versions.node, resolveBrowser = browserLocation, access = fs.access, stat = fs.stat, commandVersion = versionOf, customBrowser = Boolean(process.env.PUPPETEER_EXECUTABLE_PATH) }) {
  const checks = [];
  const [major, minor] = nodeVersion.split('.').map(Number);
  const supported = major > 22 || major === 22 && minor >= 12;
  checks.push({ id: 'node', label: 'Node.js', state: supported ? 'ready' : 'attention', detail: supported ? `Node ${nodeVersion} meets the requirement.` : `Node ${nodeVersion} is installed. BinderPress needs Node 22.12 or newer.`, ...(!supported ? { link: 'https://nodejs.org/', linkLabel: 'Get Node.js' } : {}) });
  try {
    const executable = await resolveBrowser();
    if (!(await stat(executable)).isFile()) throw Error('Browser is not a file');
    await access(executable, constants.X_OK);
    checks.push({ id: 'browser', label: 'PDF browser', state: 'ready', detail: customBrowser ? 'Your configured browser executable is available.' : 'The PDF browser executable is available.' });
  } catch (error) {
    const missingPackage = error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND';
    checks.push({ id: 'browser', label: 'PDF browser', state: 'attention', detail: missingPackage ? 'The PDF tools are not installed. Install the application dependencies, restart BinderPress, then check again.' : customBrowser ? 'The browser selected by PUPPETEER_EXECUTABLE_PATH is unavailable. Check or clear that setting in the terminal, then restart BinderPress.' : 'The PDF browser has not been downloaded, or its cache location changed. Install the browser from the application folder, then check again.', ...(!customBrowser || missingPackage ? { command: missingPackage ? 'npm ci' : 'npx puppeteer browsers install chrome' } : {}) });
  }
  try {
    if (!(await stat(directory)).isDirectory()) throw Error('Not a folder');
    await access(directory, constants.W_OK);
    checks.push({ id: 'folder', label: 'Suggested binder location', state: 'ready', detail: 'This folder is available for creating a binder.', path: directory });
  } catch {
    checks.push({ id: 'folder', label: 'Suggested binder location', state: 'attention', detail: 'This folder is missing or unavailable for writing. Use Browse in Create a binder to choose another location.', path: directory });
  }
  const [git, github] = await Promise.all([commandVersion('git'), commandVersion('gh')]);
  return { ready: checks.every(check => check.state === 'ready'), checks, optional: [
    { id: 'git', label: 'Git', state: git ? 'ready' : 'optional', detail: git || 'Not found. Install Git if you want version history or pull requests.', ...(!git ? { link: 'https://git-scm.com/downloads', linkLabel: 'Get Git' } : {}) },
    { id: 'github', label: 'GitHub CLI', state: github ? 'ready' : 'optional', detail: github || 'Not found. Install it when you want to use Save & PR.', ...(!github ? { link: 'https://cli.github.com/', linkLabel: 'Get GitHub CLI' } : {}) }
  ] };
}
