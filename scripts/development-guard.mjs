// DEVELOPMENT-GUARD-001 — deterministic, dependency-free architecture gate.
// This does not substitute for a human review or protected branch rulesets.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function validateArchitecture({ config, files, manifest, shaByPath }) {
  const errors = [];
  const tracked = new Set(files);
  if (config.decision !== 'DEVELOPMENT-GUARD-001') errors.push('Missing expected governance policy ID');
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  for (const name of config.requiredPackages || []) {
    if (!dependencies[name]) errors.push('Required UI framework dependency missing: ' + name);
  }
  for (const name of config.forbiddenUiPackages || []) {
    if (dependencies[name]) errors.push('Unapproved additional UI framework: ' + name);
  }
  const htmlExceptions = config.allowedHtml || {};
  const styles = new Set(config.allowedStyles || []);
  const publicJs = new Set(config.allowedPublicJavascript || []);
  for (const path of tracked) {
    if (/\.html?$/i.test(path)) {
      if (!Object.hasOwn(htmlExceptions, path)) {
        errors.push('Standalone HTML entry point not approved: ' + path);
      } else if (htmlExceptions[path] && shaByPath[path] !== htmlExceptions[path]) {
        errors.push('Frozen legacy HTML changed: ' + path + ' (reuse the existing framework for UI experiments)');
      }
    }
    if (/\.(css|scss|sass|less)$/i.test(path) && !styles.has(path)) {
      errors.push('Ad-hoc stylesheet not approved: ' + path);
    }
    if (/^public\/.*\.[cm]?js$/i.test(path) && !publicJs.has(path)) {
      errors.push('Standalone public JavaScript not approved: ' + path);
    }
  }
  return errors;
}

function main() {
  const config = JSON.parse(readFileSync(resolve(projectRoot, 'development-guard.config.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'));
  const git = (args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: projectRoot }).toString('utf8').split('\0').filter(Boolean);
  const shaByPath = {};
  for (const [path, sha] of Object.entries(config.allowedHtml || {})) {
    if (sha) shaByPath[path] = git(['hash-object', '--', path]);
  }
  const errors = validateArchitecture({ config, files, manifest, shaByPath });
  if (errors.length) {
    console.error('DEVELOPMENT-GUARD-001 BLOCKED:\n- ' + errors.join('\n- '));
    process.exitCode = 1;
  } else {
    console.log('DEVELOPMENT-GUARD-001 PASS: framework dependencies and approved UI entry points/styles checked.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
