import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { APP_ROOT, validateConfig } from '../scripts/lib/project-config.mjs';

const config = () => ({ title: 'Club Handbook', sections: [{ title: 'Membership', code: 'MEM', folder: 'membership' }] });

test('configuration supports independent binder identities and rejects unsafe or ambiguous sections', () => {
  const result = validateConfig(config());
  assert.equal(result.outputName, 'BINDER');
  assert.equal(result.privateSibling, null);
  assert.equal(result.sections[0].code, 'MEM');
  for (const changes of [
    { title: '' }, { organization: 'Line\nbreak' }, { outputName: '../elsewhere' },
    { outputName: 'TABLE_OF_CONTENTS' }, { privateSibling: '../private' }, { indexClass: 'x" onclick="oops' },
    { sections: [] }, { sections: Array.from({ length: 9 }, () => config().sections[0]) },
    { sections: [{ title: 'Membership', code: 'MEM', folder: '../outside' }] },
    { sections: [{ title: 'Membership', code: 'mem', folder: 'membership' }] },
    { sections: [config().sections[0], { title: 'Other', code: 'MEM', folder: 'other' }] }
  ]) assert.throws(() => validateConfig({ ...config(), ...changes }));
});

test('CLI initializes a content-only library with spaces and refuses overwrites', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'binderpress-init-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const destination = path.join(temporary, 'My Handbook');
  const cli = path.join(APP_ROOT, 'bin/binderpress.mjs');
  const run = () => spawnSync(process.execPath, [cli, 'init', destination], { encoding: 'utf8' });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual((await fs.readdir(destination)).sort(), ['README.md', 'binderpress.config.json', 'handouts']);
  const file = path.join(destination, 'handouts/getting-started/GET-001-welcome.md');
  const original = await fs.readFile(file, 'utf8');
  assert.notEqual(run().status, 0);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  const configurationFile = path.join(destination, 'binderpress.config.json');
  const configuration = JSON.parse(await fs.readFile(configurationFile, 'utf8'));
  configuration.organization = '<Club & Friends>';
  configuration.title = 'Club <Handbook>';
  await fs.writeFile(configurationFile, JSON.stringify(configuration));
  const env = { ...process.env, BINDERPRESS_CONFIG: path.join(destination, 'binderpress.config.json'), BINDERPRESS_CONTENT_DIR: destination };
  const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createEditorServer } from './scripts/lib/editor-server.mjs';
    const server = await createEditorServer({ root: process.env.BINDERPRESS_CONTENT_DIR, publicOnly: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      const list = await (await fetch(base + '/api/handouts')).json();
      assert.match(JSON.stringify(list), /GET-001/);
      const html = await (await fetch(base)).text();
      assert.match(html, /Visual handout editor/);
      const options = await (await fetch(base + '/api/library-options')).json();
      assert.match(JSON.stringify(options), /Getting Started/);
      const opened = await (await fetch(base + '/api/handout?path=' + encodeURIComponent(list[0].path))).json();
      const rendered = await (await fetch(base + '/api/render', { method: 'POST', body: JSON.stringify({ path: list[0].path, source: opened.source }) })).text();
      assert.match(rendered, /&lt;Club &amp; Friends&gt; · Club &lt;Handbook&gt;/);
      assert.doesNotMatch(rendered, /La Habra|Emergency Preparedness Binder/);
      const createdResponse = await fetch(base + '/api/handouts/new', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Club Reference', sectionNumber: 2, library: 'public', template: 'checklist', reviewDate: '2026-11-16', session: 'config-test-session' })
      });
      assert.equal(createdResponse.status, 201, await createdResponse.clone().text());
      assert.match(JSON.stringify(await createdResponse.json()), /handouts\\/reference\\/REF-001/);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  `], { cwd: APP_ROOT, env, encoding: 'utf8', timeout: 30000 });
  assert.equal(probe.status, 0, probe.stderr);
});
