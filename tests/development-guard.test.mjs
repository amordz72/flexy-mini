import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateArchitecture } from '../scripts/development-guard.mjs';

const LEGACY = '47c01e9e9b4a4ec0a5e854de76bd3980c3dc8197';
const config = {
  decision: 'DEVELOPMENT-GUARD-001',
  requiredPackages: ['antd', '@refinedev/core', '@refinedev/antd'],
  forbiddenUiPackages: ['bootstrap', '@mui/material'],
  allowedHtml: {'index.html': null, 'public/lab.html': LEGACY},
  allowedStyles: ['src/style.css'],
  allowedPublicJavascript: ['public/sw.js']
};
const valid = () => ({
  config,
  files: ['index.html', 'public/lab.html', 'src/style.css', 'src/FlexyServicePage.tsx', 'public/sw.js'],
  manifest: {dependencies: {'antd':'^5', '@refinedev/core':'^5', '@refinedev/antd':'^6'}},
  shaByPath: {'public/lab.html':LEGACY}
});
test('the existing framework-backed application passes the architecture gate', () => {
  assert.deepEqual(validateArchitecture(valid()), []);
});
test('a new bespoke standalone UI is rejected', () => {
  const fixture = valid(); fixture.files.push('public/new-custom-simulator.html');
  assert.match(validateArchitecture(fixture).join('\n'), /Standalone HTML entry point not approved/);
});
test('new ad-hoc CSS is rejected', () => {
  const fixture = valid(); fixture.files.push('src/new-screen.css');
  assert.match(validateArchitecture(fixture).join('\n'), /Ad-hoc stylesheet/);
});
test('a second UI framework is rejected', () => {
  const fixture = valid(); fixture.manifest.dependencies.bootstrap='^5';
  assert.match(validateArchitecture(fixture).join('\n'), /Unapproved additional UI framework/);
});
test('changing the frozen legacy standalone lab is rejected', () => {
  const fixture = valid(); fixture.shaByPath['public/lab.html']='changed';
  assert.match(validateArchitecture(fixture).join('\n'), /Frozen legacy HTML changed/);
});
test('removing the approved UI framework is rejected', () => {
  const fixture = valid(); delete fixture.manifest.dependencies['antd'];
  assert.match(validateArchitecture(fixture).join('\n'), /Required UI framework dependency missing/);
});
test('an unapproved public JS entry point is rejected', () => {
  const fixture = valid(); fixture.files.push('public/flexy-standalone.js');
  assert.match(validateArchitecture(fixture).join('\n'), /Standalone public JavaScript not approved/);
});
