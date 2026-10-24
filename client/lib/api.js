export async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const result = await response.json();
  if (!response.ok || !result.ok) { const error = new Error(result.error?.message || 'The request failed.'); error.status = response.status; throw error; }
  return result.data;
}
export const post = (url, data) => api(url, { method: 'POST', body: JSON.stringify(data) });
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea'); area.className = 'clipboard-fallback'; area.value = text;
  document.body.append(area); area.select();
  try { if (!document.execCommand('copy')) throw new Error('Select the command and copy it manually.'); }
  finally { area.remove(); }
}
