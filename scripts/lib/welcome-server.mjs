import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fork } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { browseFolders, createBinder, inspectBinder, projectError } from './binder-project.mjs';

const applicationRoot = fileURLToPath(new URL('../../', import.meta.url));
const send = (response, status, value) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
};
const publicFiles = { '/welcome': ['welcome/index.html', 'text/html; charset=utf-8'], '/': ['welcome/index.html', 'text/html; charset=utf-8'], '/welcome.js': ['welcome/welcome.js', 'text/javascript; charset=utf-8'], '/welcome.css': ['welcome/welcome.css', 'text/css; charset=utf-8'] };

export function createWelcomeServer({ appRoot = applicationRoot, baseDirectory = path.resolve(process.cwd()) === path.resolve(appRoot) ? path.dirname(appRoot) : process.cwd(), startupTimeout = 20000 } = {}) {
  const token = randomBytes(24).toString('hex');
  let active, pending = false, closing = false;
  const children = new Set();
  async function stop(child) {
    if (!child || child.exitCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      if (child.connected) child.send({ type: 'shutdown' }, error => { if (error) child.kill('SIGTERM'); });
      else child.kill('SIGTERM');
    });
  }
  async function start(root, { privateMode = false, firstRun = false, sample = false } = {}) {
    const project = await inspectBinder(root);
    if (closing) throw projectError('BinderPress is closing. Restart it to open a binder.');
    const workspaceId = randomBytes(24).toString('hex');
    const env = { ...process.env, BINDERPRESS_CONTENT_DIR: project.root, BINDERPRESS_FIRST_RUN: firstRun ? '1' : '0', BINDERPRESS_WORKSPACE_ID: workspaceId };
    delete env.BINDERPRESS_CONFIG;
    const child = fork(path.join(appRoot, 'scripts/editor-worker.mjs'), [privateMode ? '--private' : '--public'], { cwd: project.root, env, execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    children.add(child);
    child.once('exit', () => { children.delete(child); if (active?.child === child) active = undefined; });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
    let ready;
    try {
      ready = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(projectError('The editor took too long to open. Check the folder and try again.')), startupTimeout);
        const onExit = () => finish(projectError(stderr || 'The editor could not open this binder. Check its configuration and handouts.'));
        const onError = error => finish(error);
        const onMessage = message => {
          if (message.type === 'ready') finish(null, message);
          if (message.type === 'error') finish(projectError(message.message));
        };
        function finish(error, value) {
          clearTimeout(timer); child.off('exit', onExit); child.off('error', onError); child.off('message', onMessage);
          if (error) reject(error); else resolve(value);
        }
        child.on('exit', onExit); child.on('error', onError); child.on('message', onMessage);
      });
    } catch (error) { await stop(child); throw error; }
    if (closing) { await stop(child); throw projectError('BinderPress is closing.'); }
    const previous = active;
    active = { child, port: ready.port, root: ready.root, title: ready.title, sample, privateMode, workspaceId };
    await stop(previous?.child);
    return { title: ready.title, root: ready.root, url: '/editor' };
  }
  async function body(request) {
    let source = '';
    for await (const chunk of request) {
      source += chunk;
      if (Buffer.byteLength(source) > 32000) throw Object.assign(Error('The request is too large.'), { status: 413 });
    }
    return JSON.parse(source);
  }
  const server = http.createServer(async (request, response) => {
    try {
      const port = server.address()?.port;
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!hosts.includes(request.headers.host) || request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return send(response, 403, { error: 'Open BinderPress from its local address.' });
      const url = new URL(request.url, `http://${request.headers.host}`);
      const file = publicFiles[url.pathname];
      if (file && request.method === 'GET') {
        response.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
        return response.end(await fs.readFile(path.join(appRoot, file[0])));
      }
      if (url.pathname === '/api/welcome' && request.method === 'GET') return send(response, 200, { token, baseDirectory, active: active ? { title: active.title, root: active.root, sample: active.sample } : null });
      if (url.pathname.startsWith('/api/welcome/')) {
        if (request.method !== 'POST' || request.headers['x-binderpress-token'] !== token) return send(response, 403, { error: 'Refresh the welcome page and try again.' });
        if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(response, 415, { error: 'Send this request as JSON.' });
        const value = await body(request);
        if (url.pathname === '/api/welcome/browse') return send(response, 200, await browseFolders(typeof value.path === 'string' && value.path.trim() ? path.resolve(baseDirectory, value.path) : baseDirectory));
        if (!['/api/welcome/create', '/api/welcome/open', '/api/welcome/sample'].includes(url.pathname)) return send(response, 404, { error: 'Not found' });
        if (pending) return send(response, 409, { error: 'A binder is already opening. Please wait.' });
        pending = true;
        try {
          let opened;
          if (url.pathname === '/api/welcome/sample') opened = await start(path.join(appRoot, 'examples/starter'), { sample: true });
          else if (url.pathname === '/api/welcome/open') {
            if (typeof value.directory !== 'string' || !value.directory.trim()) throw projectError('Choose the folder containing your binder.');
            opened = await start(path.resolve(baseDirectory, value.directory), { privateMode: value.privateMode === true });
          } else {
            const created = await createBinder({ ...value, directory: typeof value.directory === 'string' && value.directory.trim() ? path.resolve(baseDirectory, value.directory) : '' }, { appRoot });
            try { opened = await start(created.root, { firstRun: true }); }
            catch (error) { throw projectError(`Your binder was created at ${created.root}, but the editor could not open it: ${error.message}. Use Open an existing binder to try again.`); }
          }
          return send(response, 200, opened);
        } finally { pending = false; }
      }
      if (!active) return send(response, 409, { error: 'Choose a binder on the welcome page first.', url: '/welcome' });
      const current = active;
      if (url.pathname.startsWith('/api/') && (request.headers['x-binderpress-workspace'] || !['GET', 'HEAD'].includes(request.method)) && request.headers['x-binderpress-workspace'] !== current.workspaceId) return send(response, 409, { error: 'Another binder has been opened. Your edits are preserved in this tab. Return to the welcome page and reopen the intended binder before saving.' });
      const headers = { ...request.headers, host: `127.0.0.1:${current.port}` };
      if (headers.origin) headers.origin = `http://${headers.host}`;
      const upstream = http.request({ hostname: '127.0.0.1', port: current.port, method: request.method, path: url.pathname === '/editor' ? '/' + url.search : request.url, headers }, upstreamResponse => {
        response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      });
      upstream.on('error', () => { if (!response.headersSent) send(response, 502, { error: 'The editor stopped. Return to the welcome page to reopen the binder.', url: '/welcome' }); else response.end(); });
      request.on('aborted', () => upstream.destroy());
      request.pipe(upstream);
    } catch (error) {
      const message = error.code === 'ENOENT' ? 'That folder or its binderpress.config.json could not be found. Check the location and try again.' : error.code === 'EACCES' || error.code === 'EPERM' ? 'BinderPress cannot access that folder. Choose another location or check its permissions.' : error.message;
      send(response, error.status || 422, { error: message });
    }
  });
  server.on('close', () => { closing = true; for (const child of children) void stop(child); });
  server.closeEditors = async () => { closing = true; await Promise.all([...children].map(stop)); };
  return server;
}
