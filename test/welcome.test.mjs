import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import { createBinder } from '../scripts/lib/binder-project.mjs';
import { createWelcomeServer } from '../scripts/lib/welcome-server.mjs';
import { APP_ROOT } from '../scripts/lib/project-config.mjs';
import puppeteer from 'puppeteer';
import { browserOptions } from '../scripts/lib/artifact-generation.mjs';

const definition = directory => ({ directory, title: 'Club Handbook', organization: 'Local Club', sections: [{ title: 'Membership', code: 'MEM', folder: 'membership' }, { title: 'Reference', code: 'REF', folder: 'reference' }] });
async function setup(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'binderpress-welcome-'));
  const server = createWelcomeServer({ baseDirectory: temporary });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await server.closeEditors(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(temporary, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const info = await (await fetch(base + '/api/welcome')).json();
  const post = async (action, value = {}) => {
    const response = await fetch(base + '/api/welcome/' + action, { method: 'POST', headers: { 'content-type': 'application/json', 'x-binderpress-token': info.token }, body: JSON.stringify(value) });
    return { status: response.status, data: await response.json() };
  };
  return { temporary, server, base, post, info };
}

test('new binders contain independent configuration and a valid first draft; existing folders are preserved', async t => {
  const { temporary, post, base } = await setup(t);
  const directory = path.join(temporary, 'My Club Handbook');
  const result = await post('create', definition(directory));
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.url, '/editor');
  assert.deepEqual((await fs.readdir(directory)).sort(), ['.gitignore', 'README.md', 'binderpress.config.json', 'handouts']);
  const context = await (await fetch(base + '/api/workspace')).json();
  assert.equal(context.title, 'Club Handbook'); assert.equal(context.root, directory);
  assert.equal(context.firstRun, true); assert.equal(context.sample, false); assert.equal(context.launcher, true);
  const documents = await (await fetch(base + '/api/handouts')).json();
  assert.equal(documents[0].code, 'MEM-001'); assert.equal(documents[0].status, 'draft');
  const source = await fs.readFile(path.join(directory, documents[0].path), 'utf8');
  assert.match(source, /editor: unassigned/); assert.match(source, /\[VERIFY/);
  const duplicate = await post('create', definition(directory));
  assert.equal(duplicate.status, 422); assert.match(duplicate.data.error, /already exists/);
  assert.equal(await fs.readFile(path.join(directory, documents[0].path), 'utf8'), source);
});

test('invalid sections and application-local destinations create no project files', async t => {
  const { temporary, post } = await setup(t);
  const directory = path.join(temporary, 'invalid');
  const bad = definition(directory); bad.sections[1].code = 'MEM';
  const result = await post('create', bad);
  assert.equal(result.status, 422); assert.match(result.data.error, /duplicate section code/);
  await assert.rejects(fs.access(directory), /ENOENT/);
  await assert.rejects(createBinder(definition(path.join(APP_ROOT, 'forbidden-binder')), { appRoot: APP_ROOT }), /outside BinderPress/);
});

test('opening a different binder reloads sections in a separate process and failed opens preserve the active binder', async t => {
  const { temporary, post, base } = await setup(t);
  assert.equal((await post('sample')).status, 200);
  assert.equal((await (await fetch(base + '/api/workspace')).json()).sample, true);
  const directory = path.join(temporary, 'Independent Handbook');
  await createBinder(definition(directory), { appRoot: APP_ROOT });
  assert.equal((await post('open', { directory })).status, 200);
  let context = await (await fetch(base + '/api/workspace')).json();
  assert.equal(context.title, 'Club Handbook'); assert.equal(context.firstRun, false);
  const options = await (await fetch(base + '/api/library-options')).json();
  assert.deepEqual(options.sections.map(section => section.prefix), ['MEM', 'REF']);
  const invalid = await post('open', { directory: temporary });
  assert.equal(invalid.status, 422); assert.match(invalid.data.error, /no binderpress.config.json/);
  context = await (await fetch(base + '/api/workspace')).json();
  assert.equal(context.root, directory);
});

test('private mode requires the linked checkout and the public selection ignores a broken local link', async t => {
  const { temporary, post, base } = await setup(t);
  const directory = path.join(temporary, 'Private Setup');
  await createBinder(definition(directory), { appRoot: APP_ROOT });
  await fs.writeFile(path.join(directory, '.binder-local.json'), JSON.stringify({ privateDirectory: '../unavailable-private' }));
  assert.equal((await post('open', { directory, privateMode: true })).status, 422);
  assert.equal((await post('open', { directory, privateMode: false })).status, 200);
  assert.equal((await (await fetch(base + '/api/workspace')).json()).private, false);
});

test('welcome routes reject foreign origins, host rebinding, missing tokens, and oversized requests', async t => {
  const { temporary, base, info } = await setup(t);
  for (const headers of [{}, { 'x-binderpress-token': info.token, origin: 'https://example.org' }]) {
    const result = await fetch(base + '/api/welcome/create', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(definition(path.join(temporary, 'blocked'))) });
    assert.equal(result.status, 403);
  }
  const rebinding = await new Promise((resolve, reject) => {
    const request = http.request(base + '/api/welcome', { headers: { host: 'example.org' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(rebinding, 403);
  const large = await fetch(base + '/api/welcome/create', { method: 'POST', headers: { 'content-type': 'application/json', 'x-binderpress-token': info.token }, body: JSON.stringify({ title: 'x'.repeat(33000) }) });
  assert.equal(large.status, 413);
  await assert.rejects(fs.access(path.join(temporary, 'blocked')), /ENOENT/);
});

test('an old editor tab cannot save into a newly selected binder', async t => {
  const { temporary, post, base } = await setup(t);
  const first = path.join(temporary, 'First'), second = path.join(temporary, 'Second');
  await createBinder(definition(first), { appRoot: APP_ROOT });
  await createBinder(definition(second), { appRoot: APP_ROOT });
  assert.equal((await post('open', { directory: first })).status, 200);
  const html = await (await fetch(base + '/editor')).text();
  const oldSession = html.match(/name="binderpress-session" content="([^"]+)"/)[1];
  const file = 'handouts/membership/MEM-001-first-page.md';
  const opened = await (await fetch(base + '/api/handout?path=' + file)).json();
  assert.equal((await post('open', { directory: second })).status, 200);
  const result = await fetch(base + '/api/save', { method: 'POST', headers: { 'content-type': 'application/json', 'x-binderpress-workspace': oldSession }, body: JSON.stringify({ path: file, revision: opened.revision, source: opened.source.replace('Your first page', 'Wrong binder'), session: 'old-browser-session' }) });
  assert.equal(result.status, 409);
  assert.doesNotMatch(await fs.readFile(path.join(second, file), 'utf8'), /Wrong binder/);
});

test('browser drafts with the same handout path remain isolated between binders', async t => {
  const { temporary, post, base } = await setup(t);
  const first = path.join(temporary, 'First'), second = path.join(temporary, 'Second');
  await createBinder(definition(first), { appRoot: APP_ROOT }); await createBinder(definition(second), { appRoot: APP_ROOT });
  const browser = await puppeteer.launch(browserOptions()); t.after(() => browser.close());
  const page = await browser.newPage();
  assert.equal((await post('open', { directory: first })).status, 200);
  await page.goto(base + '/editor', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('#source')?.value.includes('MEM-001'));
  assert.equal(await page.$eval('#first-page-guide', element => getComputedStyle(element).display), 'none');
  const firstKey = await page.$eval('meta[name=binderpress-drafts]', element => element.content);
  await page.click('#source-mode');
  await page.$eval('#source', element => { element.value += '\nUNSAVED FIRST BINDER TEXT\n'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(key => localStorage.getItem('handout-editor:draft:' + key + ':handouts/membership/MEM-001-first-page.md')?.includes('UNSAVED FIRST BINDER TEXT'), {}, firstKey);
  assert.equal((await post('open', { directory: second })).status, 200);
  const next = await browser.newPage(); await next.goto(base + '/editor', { waitUntil: 'networkidle0' });
  await next.waitForFunction(() => document.querySelector('#source')?.value.includes('MEM-001'));
  assert.notEqual(await next.$eval('meta[name=binderpress-drafts]', element => element.content), firstKey);
  assert.equal(await next.$eval('#draft-recovery', element => element.hidden), true);
  assert.doesNotMatch(await next.$eval('#source', element => element.value), /UNSAVED FIRST BINDER TEXT/);
});

test('folder browsing uses server paths and does not offer hidden or non-directory entries', async t => {
  const { temporary, post } = await setup(t);
  await fs.mkdir(path.join(temporary, 'Visible folder'));
  await fs.mkdir(path.join(temporary, '.hidden'));
  await fs.writeFile(path.join(temporary, 'file.md'), 'file');
  const result = await post('browse', { path: temporary });
  assert.equal(result.status, 200); assert.equal(result.data.path, temporary);
  assert.deepEqual(result.data.folders.map(folder => folder.name), ['Visible folder']);
});

test('setup checks and the Windows guide are available without opening a binder', async t => {
  const { post, base } = await setup(t);
  const response = await post('diagnostics');
  assert.equal(response.status, 200);
  assert.deepEqual(response.data.checks.map(check => check.id), ['node', 'browser', 'folder']);
  assert.deepEqual(response.data.optional.map(check => check.id), ['git', 'github']);
  assert.equal((await (await fetch(base + '/api/welcome')).json()).active, null);
  const guide = await fetch(base + '/windows-quickstart');
  assert.equal(guide.status, 200);
  assert.match(await guide.text(), /BinderPress on Windows/);
  assert.equal((await fetch(base + '/setup-controls.js')).status, 200);
});

test('setup dialog shows checks, optional GitHub instructions, and remains usable on mobile', async t => {
  const { base } = await setup(t);
  const browser = await puppeteer.launch(browserOptions()); t.after(() => browser.close());
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.querySelector('#setup-check').disabled);
  await page.click('#setup-check');
  await page.waitForFunction(() => document.querySelectorAll('#setup-results .setup-result').length === 3);
  assert.equal(await page.$eval('#setup-dialog', dialog => dialog.open), true);
  assert.match(await page.$eval('#setup-summary', element => element.textContent), /checks passed|need attention/);
  await page.click('#github-setup summary');
  assert.match(await page.$eval('#github-setup', element => element.textContent), /gh auth login/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.click('#setup-retry');
  await page.waitForFunction(() => !document.querySelector('#setup-retry').disabled);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#setup-dialog', dialog => dialog.open), false);
});

test('setup recovery commands are displayed and copied without executing them', async t => {
  const { base } = await setup(t);
  const browser = await puppeteer.launch(browserOptions()); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedCommand = text; } } }));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().endsWith('/api/welcome/diagnostics')) return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ready: false, checks: [{ id: 'browser', label: 'PDF browser', state: 'attention', detail: 'Download the missing browser.', command: 'npx puppeteer browsers install chrome' }], optional: [] }) });
    return request.continue();
  });
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.click('#setup-check');
  await page.waitForSelector('.setup-command button');
  assert.match(await page.$eval('#setup-summary', element => element.textContent), /need attention/);
  await page.click('.setup-command button');
  await page.waitForFunction(() => window.copiedCommand === 'npx puppeteer browsers install chrome');
  assert.equal(await page.$eval('.setup-command button', element => element.textContent), 'Copied');
});

test('welcome browser flow creates a binder, shows its identity, and saves an independent first page', async t => {
  const { temporary, base } = await setup(t);
  const browser = await puppeteer.launch(browserOptions()); t.after(() => browser.close());
  const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.querySelector('#new-binder').disabled);
  await page.click('#new-binder');
  await page.type('#binder-title', 'Neighborhood Guide');
  await page.type('#binder-organization', 'Neighborhood Team');
  await page.$eval('#create-directory', (element, value) => { element.value = value; element.dispatchEvent(new Event('input', { bubbles: true })); }, path.join(temporary, 'Neighborhood Guide'));
  await page.click('#create-submit');
  await page.waitForFunction(() => location.pathname === '/editor');
  await page.waitForFunction(() => document.querySelector('#source')?.value.includes('GET-001'));
  await page.waitForFunction(() => !document.querySelector('#binder-context').hidden);
  assert.equal(await page.$eval('#binder-name', element => element.textContent), 'Neighborhood Guide');
  assert.equal(await page.$eval('#first-page-guide', element => element.hidden), false);
  await page.click('#source-mode');
  await page.$eval('#source', element => { element.value = element.value.replace('Your first page', 'My first neighborhood page'); element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#save');
  await page.waitForFunction(() => document.querySelector('#state').textContent.includes('Saved'));
  const source = await fs.readFile(path.join(temporary, 'Neighborhood Guide/handouts/getting-started/GET-001-first-page.md'), 'utf8');
  assert.match(source, /My first neighborhood page/);
  await page.click('#build-proof');
  await page.waitForFunction(() => !document.querySelector('#proof-download').disabled, { timeout: 30000 });
  const download = page.waitForResponse(response => response.url().endsWith('/api/proofs/download'));
  await page.click('#proof-download');
  const pdf = await download;
  assert.equal(pdf.status(), 200);
  assert.match(pdf.headers()['content-type'], /application\/pdf/);
  await page.click('#proof-dialog .dialog-heading button');
  await page.click('#change-binder');
  await page.waitForFunction(() => location.pathname === '/welcome');
  await page.waitForSelector('#resume:not([hidden])');
  assert.match(await page.$eval('#resume', element => element.textContent), /Neighborhood Guide/);
  assert.deepEqual(errors, []);
});

test('welcome stays usable on small screens and folder chooser supports keyboard cancellation', async t => {
  const { base } = await setup(t);
  const browser = await puppeteer.launch(browserOptions()); t.after(() => browser.close());
  const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.click('#open-binder'); await page.click('#browse-open');
  await page.waitForFunction(() => document.querySelector('#folder-dialog').open);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#folder-dialog', element => element.open), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});
