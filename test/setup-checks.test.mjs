import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSetup } from '../scripts/lib/setup-checks.mjs';

const options = extra => ({ directory: '/binder-location', nodeVersion: '22.23.2', resolveBrowser: async () => '/chrome', stat: async file => ({ isFile: () => file === '/chrome', isDirectory: () => file === '/binder-location' }), access: async () => {}, commandVersion: async () => null, customBrowser: false, ...extra });

test('editing setup can be ready without Git or GitHub CLI', async () => {
  const result = await inspectSetup(options());
  assert.equal(result.ready, true);
  assert.deepEqual(result.checks.map(check => check.state), ['ready', 'ready', 'ready']);
  assert.deepEqual(result.optional.map(check => check.state), ['optional', 'optional']);
  assert.doesNotMatch(JSON.stringify(result), /auth.*failed/i);
});

test('Node checks enforce the actual minimum version', async () => {
  for (const [version, supported] of [['20.19.0', false], ['22.11.0', false], ['22.12.0', true], ['24.19.0', true]]) {
    const result = await inspectSetup(options({ nodeVersion: version }));
    assert.equal(result.checks[0].state === 'ready', supported, version);
    assert.equal(result.ready, supported, version);
  }
});

test('missing browser recovery differs from a missing package and a broken custom browser', async () => {
  const unavailable = async () => { throw Object.assign(Error('internal path or diagnostic details'), { code: 'ENOENT' }); };
  let result = await inspectSetup(options({ resolveBrowser: unavailable }));
  assert.equal(result.ready, false);
  assert.equal(result.checks[1].command, 'npx puppeteer browsers install chrome');
  assert.doesNotMatch(JSON.stringify(result), /internal path or diagnostic details/);
  result = await inspectSetup(options({ resolveBrowser: async () => { throw Object.assign(Error('missing'), { code: 'ERR_MODULE_NOT_FOUND' }); } }));
  assert.equal(result.checks[1].command, 'npm ci');
  assert.match(result.checks[1].detail, /restart/);
  result = await inspectSetup(options({ resolveBrowser: unavailable, customBrowser: true }));
  assert.equal(result.checks[1].command, undefined);
  assert.match(result.checks[1].detail, /PUPPETEER_EXECUTABLE_PATH/);
});

test('a directory cannot pass as a browser and inaccessible destinations get folder recovery', async () => {
  let result = await inspectSetup(options({ resolveBrowser: async () => '/binder-location' }));
  assert.equal(result.checks[1].state, 'attention');
  result = await inspectSetup(options({ access: async directory => { if (directory === '/binder-location') throw Object.assign(Error('permission denied'), { code: 'EACCES' }); } }));
  assert.equal(result.ready, false);
  assert.equal(result.checks[2].state, 'attention');
  assert.match(result.checks[2].detail, /Browse/);
  assert.equal(result.checks[2].path, '/binder-location');
});
