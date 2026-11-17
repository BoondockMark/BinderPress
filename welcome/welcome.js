const $ = selector => document.querySelector(selector);
let token, baseDirectory, busy = false, customFolder = false, browseTarget, folderLocation;
const slug = value => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'my-handbook';
const join = (parent, name) => parent.replace(/[\\/]$/, '') + (parent.includes('\\') ? '\\' : '/') + name;
const status = (message, loading = false) => {
  $('#status').textContent = message; $('#status').hidden = !message; $('#status').dataset.busy = String(loading);
  if (message && !loading) $('#status').focus();
};
async function api(action, value) {
  const response = await fetch('/api/welcome/' + action, { method: 'POST', headers: { 'content-type': 'application/json', 'x-binderpress-token': token }, body: JSON.stringify(value) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Something went wrong. Please try again.');
  return result;
}
function view(name) {
  document.querySelectorAll('.view').forEach(element => { element.hidden = element.id !== name + '-view'; });
  status('');
  const heading = $('#' + name + '-view h1'); heading.tabIndex = -1; heading.focus();
}
function buttonsDisabled(disabled) {
  document.querySelectorAll('main button, main input').forEach(element => { element.disabled = disabled; });
  if (!disabled) updateSections();
}
async function open(action, value) {
  if (busy || !token) return;
  busy = true; buttonsDisabled(true); status(action === 'create' ? 'Creating your binder and opening the first draft…' : 'Opening your binder…', true);
  try { const result = await api(action, value); window.location.assign(result.url); }
  catch (error) { busy = false; buttonsDisabled(false); status(error.message); }
}
function updateSections() {
  const rows = [...$('#sections').children];
  rows.forEach((row, index) => {
    row.querySelector('[data-remove]').disabled = rows.length === 1;
    for (const input of row.querySelectorAll('input')) input.setAttribute('aria-label', `Section ${index + 1} ${input.dataset.field === 'title' ? 'name' : 'code'}`);
  });
  $('#add-section').disabled = rows.length >= 8;
}
function addSection(title = '', code = '') {
  const row = $('#section-template').content.firstElementChild.cloneNode(true);
  row.querySelector('[data-field=title]').value = title;
  row.querySelector('[data-field=code]').value = code;
  row.querySelector('[data-field=title]').addEventListener('input', event => {
    const input = row.querySelector('[data-field=code]');
    if (!input.dataset.edited) input.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  });
  row.querySelector('[data-field=code]').addEventListener('input', event => { event.target.value = event.target.value.toUpperCase(); event.target.dataset.edited = 'true'; });
  row.querySelector('[data-remove]').addEventListener('click', () => { row.remove(); updateSections(); });
  $('#sections').append(row); updateSections();
}
$('#new-binder').addEventListener('click', () => view('create'));
$('#open-binder').addEventListener('click', () => view('open'));
document.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', () => view('home')));
$('#try-sample').addEventListener('click', () => open('sample', {}));
$('#add-section').addEventListener('click', () => { addSection(); $('#sections').lastElementChild.querySelector('input').focus(); });
$('#binder-title').addEventListener('input', () => { if (!customFolder) $('#create-directory').value = join(baseDirectory, slug($('#binder-title').value)); });
$('#create-directory').addEventListener('input', () => { customFolder = true; });
$('#create-form').addEventListener('submit', event => {
  event.preventDefault();
  const sections = [...$('#sections').children].map(row => ({ title: row.querySelector('[data-field=title]').value.trim(), code: row.querySelector('[data-field=code]').value, folder: slug(row.querySelector('[data-field=title]').value) }));
  open('create', { title: $('#binder-title').value.trim(), organization: $('#binder-organization').value.trim(), directory: $('#create-directory').value, sections });
});
$('#open-form').addEventListener('submit', event => { event.preventDefault(); open('open', { directory: $('#open-directory').value, privateMode: $('#include-private').checked }); });
async function browse(directory) {
  $('#folder-error').textContent = '';
  $('#folder-select').disabled = true;
  try {
    const result = await api('browse', { path: directory });
    folderLocation = result.path; $('#folder-path').value = result.path;
    $('#folder-up').disabled = result.parent === result.path;
    $('#folder-up').onclick = () => browse(result.parent);
    $('#folder-list').replaceChildren();
    for (const folder of result.folders) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = '▱  ' + folder.name;
      button.addEventListener('click', () => browse(folder.path)); $('#folder-list').append(button);
    }
    if (!result.folders.length) { const p = document.createElement('p'); p.textContent = 'No subfolders here.'; $('#folder-list').append(p); }
    if (result.truncated) $('#folder-error').textContent = 'Showing the first 200 folders. You can enter a location above.';
    $('#folder-select').disabled = false;
  } catch (error) { $('#folder-error').textContent = error.message; }
}
async function showBrowse(target) {
  browseTarget = target; $('#folder-select').disabled = true;
  $('#folder-help').textContent = target === 'create' ? 'Choose a parent folder. A new binder folder will be created inside it.' : 'Choose the folder containing binderpress.config.json.';
  $('#folder-dialog').showModal(); await browse(baseDirectory);
}
$('#browse-create').addEventListener('click', () => showBrowse('create'));
$('#browse-open').addEventListener('click', () => showBrowse('open'));
$('#folder-cancel').addEventListener('click', () => $('#folder-dialog').close());
$('#folder-path-form').addEventListener('submit', event => { event.preventDefault(); browse($('#folder-path').value); });
$('#folder-select').addEventListener('click', () => {
  if (browseTarget === 'create') { $('#create-directory').value = join(folderLocation, slug($('#binder-title').value)); customFolder = true; }
  else $('#open-directory').value = folderLocation;
  $('#folder-dialog').close();
});
addSection('Getting Started', 'GET'); addSection('Reference', 'REF');
buttonsDisabled(true);
try {
  const response = await fetch('/api/welcome');
  if (!response.ok) throw Error('Could not load BinderPress. Refresh this page to try again.');
  const info = await response.json(); token = info.token; baseDirectory = info.baseDirectory;
  $('#create-directory').value = join(baseDirectory, 'my-handbook'); $('#open-directory').value = baseDirectory;
  if (info.active) { $('#resume').textContent = `Return to ${info.active.title}${info.active.sample ? ' (sample)' : ''} →`; $('#resume').hidden = false; }
  buttonsDisabled(false);
  if (location.hash === '#create') view('create');
} catch (error) { status(error.message); }
