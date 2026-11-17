export function setupControls({ api }) {
  const dialog = document.querySelector('#setup-dialog');
  const summary = document.querySelector('#setup-summary');
  const results = document.querySelector('#setup-results');
  const optional = document.querySelector('#setup-optional');
  const retry = document.querySelector('#setup-retry');
  let checking = false;
  function render(items, container) {
    container.replaceChildren();
    for (const item of items) {
      const row = document.createElement('li'); row.className = 'setup-result';
      const heading = document.createElement('div'); heading.className = 'setup-heading';
      const label = document.createElement('strong'); label.textContent = item.label;
      const badge = document.createElement('span'); badge.className = 'setup-badge ' + item.state;
      badge.textContent = item.state === 'ready' ? 'Ready' : item.state === 'optional' ? 'Optional' : 'Needs attention';
      heading.append(label, badge); row.append(heading);
      const detail = document.createElement('p'); detail.textContent = item.detail; row.append(detail);
      if (item.path) { const location = document.createElement('p'); location.className = 'setup-path'; location.textContent = item.path; row.append(location); }
      if (item.command) {
        const command = document.createElement('div'); command.className = 'setup-command';
        const code = document.createElement('code'); code.textContent = item.command;
        const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'secondary'; copy.textContent = 'Copy command';
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(item.command); copy.textContent = 'Copied'; }
          catch { copy.textContent = 'Select and copy the command'; const selection = getSelection(); const range = document.createRange(); range.selectNodeContents(code); selection.removeAllRanges(); selection.addRange(range); }
        });
        command.append(code, copy); row.append(command);
      }
      if (item.link) { const link = document.createElement('a'); link.href = item.link; link.textContent = item.linkLabel; link.target = '_blank'; link.rel = 'noopener noreferrer'; row.append(link); }
      container.append(row);
    }
  }
  async function check() {
    if (checking) return;
    checking = true; retry.disabled = true; summary.textContent = 'Checking this computer…';
    try {
      const result = await api('diagnostics', {});
      summary.textContent = result.ready ? 'The basic setup checks passed. Open a binder to start writing.' : 'A few things need attention. You can still open the editor; PDF proofs need an available browser.';
      render(result.checks, results); render(result.optional, optional);
    } catch (error) { summary.textContent = error.message; }
    finally { checking = false; retry.disabled = false; }
  }
  document.querySelector('#setup-check').addEventListener('click', () => { dialog.showModal(); void check(); });
  retry.addEventListener('click', check);
  document.querySelector('#setup-close').addEventListener('click', () => dialog.close());
}
