import fs from 'node:fs/promises';
import path from 'node:path';
import { validateConfig, readConfig } from './config-schema.mjs';

export const projectError = message => Object.assign(Error(message), { status: 422 });

export async function inspectBinder(directory) {
  const root = await fs.realpath(directory);
  let config;
  try { config = readConfig(path.join(root, 'binderpress.config.json')); }
  catch (error) {
    if (error.cause?.code === 'ENOENT') throw projectError('This folder has no binderpress.config.json. Choose a binder content folder, or create a new binder.');
    throw error;
  }
  if (!(await fs.stat(path.join(root, 'handouts'))).isDirectory()) throw projectError('Choose a binder folder containing a handouts folder.');
  return { root, config };
}

export async function browseFolders(directory) {
  const root = await fs.realpath(directory);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const folders = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name));
  return { path: root, parent: path.dirname(root), folders: folders.slice(0, 200).map(entry => ({ name: entry.name, path: path.join(root, entry.name) })), truncated: folders.length > 200 };
}

export async function createBinder({ directory, title, organization, sections }, { appRoot, today = new Date() }) {
  if (typeof directory !== 'string' || !directory.trim()) throw projectError('Choose a new folder for your binder.');
  const config = validateConfig({ title, organization, outputName: 'BINDER', sections });
  const destination = path.resolve(directory.trim());
  const parent = await fs.realpath(path.dirname(destination));
  const root = path.join(parent, path.basename(destination));
  const application = await fs.realpath(appRoot);
  if (root === application || root.startsWith(application + path.sep)) throw projectError('Choose a folder outside BinderPress so your content stays separate from the application.');
  try { await fs.mkdir(root); }
  catch (error) {
    if (error.code === 'EEXIST') throw projectError('That folder already exists. Choose a new folder, or use Open an existing binder.');
    throw error;
  }
  const created = [], directories = [];
  const write = async (file, contents) => { await fs.writeFile(file, contents, { flag: 'wx' }); created.push(file); };
  try {
    const section = config.sections[0];
    for (const folder of ['handouts', `handouts/${section.folder}`]) {
      const full = path.join(root, folder); await fs.mkdir(full); directories.push(full);
    }
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const source = `---\ncode: ${section.code}-001\ntitle: Your first page\nsection: ${JSON.stringify(section.title)}\nsectionNumber: 1\nstatus: draft\nversion: 0.1\nlastReviewed: ${date}\nreviewers:\n  editor: unassigned\n  subjectMatter: unassigned\nsources:\n  - type: local\n    title: Draft source record\n    provider: Unassigned\n    location: "[VERIFY and record your source]"\n    receivedDate: ${date}\n---\n## Welcome\n\n[VERIFY and introduce this binder to your readers.]\n\n## What readers need to know\n\n[VERIFY and add your first instructions or reference material.]\n`;
    await write(path.join(root, 'binderpress.config.json'), JSON.stringify(config, null, 2) + '\n');
    await write(path.join(root, 'handouts', section.folder, `${section.code}-001-first-page.md`), source);
    await write(path.join(root, '.gitignore'), 'build/\n.binder-local.json\n.DS_Store\n');
    await write(path.join(root, 'README.md'), `# ${config.title}\n\nThis folder contains your binder content. The BinderPress application is installed separately.\n\nRun npm start from the BinderPress application folder, then choose Open an existing binder and select this folder.\n\nIf the binderpress command is installed on your PATH, you can also run:\n\n\`\`\`sh\nbinderpress editor --content .\nbinderpress build --content . --public\n\`\`\`\n\nPages start as drafts and require review before approval. PDFs go to docs/pdfs/.\nPrivate content belongs in a separate checkout. GitHub setup is optional for local editing.\n`);
    return { root, config };
  } catch (error) {
    for (const file of created.reverse()) await fs.unlink(file).catch(() => {});
    for (const folder of directories.reverse()) await fs.rmdir(folder).catch(() => {});
    await fs.rmdir(root).catch(() => {});
    throw error;
  }
}
