export function workspaceHeaders(headers = {}) {
  const result = new Headers(headers);
  const id = document.querySelector('meta[name=binderpress-session]')?.content;
  if (id) result.set('x-binderpress-workspace', id);
  return result;
}
