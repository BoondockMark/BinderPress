import { workspaceHeaders } from './workspace-session.js';

export async function showWorkspace() {
  try {
    const response = await fetch('/api/workspace', { headers: workspaceHeaders() });
    if (!response.ok) return;
    const info = await response.json();
    document.querySelector('#binder-name').textContent = info.title;
    document.querySelector('#binder-kind').textContent = info.sample ? 'Sample · fictional draft content' : info.private ? 'Your binder · includes private pages' : 'Your binder · public pages';
    document.querySelector('#binder-kind').classList.toggle('sample-badge', info.sample);
    document.querySelector('#binder-folder').textContent = info.root;
    const change = document.querySelector('#change-binder'); change.hidden = !info.launcher;
    if (info.sample) { change.textContent = 'Create your own binder'; change.href = '/welcome#create'; }
    document.querySelector('#binder-context').hidden = false;
    document.querySelector('#first-page-guide').hidden = !info.firstRun;
    document.querySelector('#dismiss-first-guide').addEventListener('click', () => { document.querySelector('#first-page-guide').hidden = true; });
  } catch { /* The editor can still be used if the context request fails. */ }
}
