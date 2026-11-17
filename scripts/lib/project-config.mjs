import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CONTENT_ROOT = path.resolve(process.env.BINDERPRESS_CONTENT_DIR || (
  path.resolve(process.cwd()) === path.resolve(APP_ROOT)
    ? path.join(APP_ROOT, 'examples/starter') : process.cwd()
));

export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('configuration must be an object');
  const config = { organization: '', outputName: 'BINDER', indexClass: 'binderpress-binder', privateSibling: null, ...input };
  for (const key of ['title', 'organization']) {
    if (typeof config[key] !== 'string' || /[\r\n]/.test(config[key]) || (key === 'title' && !config[key].trim())) throw Error(`${key} must be text on one line`);
  }
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(config.outputName) || config.outputName === 'TABLE_OF_CONTENTS' || /^[A-Z]{3}_?\d{3}$/.test(config.outputName)) throw Error('outputName must be a distinct uppercase filename stem');
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(config.indexClass)) throw Error('indexClass must be a CSS class name');
  if (config.privateSibling !== null && (typeof config.privateSibling !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(config.privateSibling))) throw Error('privateSibling must be a sibling folder name or null');
  if (!Array.isArray(config.sections) || !config.sections.length || config.sections.length > 8) throw Error('sections must contain 1–8 entries for the US Letter edge tabs');
  const seen = { title: new Set(), code: new Set(), folder: new Set() };
  config.sections = config.sections.map((section, index) => {
    if (!section || typeof section !== 'object') throw Error(`section ${index + 1} must be an object`);
    if (typeof section.title !== 'string' || !section.title.trim() || section.title !== section.title.trim() || /[\r\n|]/.test(section.title) || [...section.title].length > 22) throw Error(`section ${index + 1} title must contain 1–22 characters`);
    if (!/^[A-Z]{3}$/.test(section.code)) throw Error(`section ${index + 1} code must contain three uppercase letters`);
    if (typeof section.folder !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.folder)) throw Error(`section ${index + 1} folder must be a simple folder name`);
    for (const key of Object.keys(seen)) {
      if (seen[key].has(section[key])) throw Error(`duplicate section ${key}: ${section[key]}`);
      seen[key].add(section[key]);
    }
    return Object.freeze({ title: section.title, code: section.code, folder: section.folder });
  });
  return Object.freeze({ ...config, sections: Object.freeze(config.sections) });
}

export function readConfig(file) {
  try { return validateConfig(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (error) { throw Error(`${file}: ${error.message}`, { cause: error }); }
}

export const CONFIG = readConfig(process.env.BINDERPRESS_CONFIG || path.join(CONTENT_ROOT, 'binderpress.config.json'));
