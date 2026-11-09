import { googleSheetsConfig } from '../config.js';

let requestId = 0;

export function getRegisteredParticipantCount() {
  return new Promise((resolve, reject) => {
    const callbackName = `__memoriaVivaCount${Date.now()}_${requestId++}`;
    const script = document.createElement('script');
    const url = new URL(googleSheetsConfig.endpoint);
    let settled = false;

    url.searchParams.set('action', 'count');
    url.searchParams.set('callback', callbackName);
    url.searchParams.set('_', String(Date.now()));

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const timeoutId = window.setTimeout(() => {
      finish(reject, new Error('Apps Script no respondió el conteo de registros.'));
    }, 12000);

    window[callbackName] = response => {
      if (!response?.ok || !Number.isFinite(Number(response.count))) {
        const description = [response?.error, response?.detail].filter(Boolean).join(': ');
        finish(reject, new Error(description || 'Apps Script devolvió un conteo inválido.'));
        return;
      }
      finish(resolve, Math.max(0, Math.floor(Number(response.count))));
    };
    script.async = true;
    script.src = url.href;
    script.onerror = () => finish(reject, new Error('No se pudo consultar Google Sheets.'));
    document.head.append(script);
  });
}
