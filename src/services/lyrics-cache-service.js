import { googleSheetsConfig } from '../config.js';

let requestId = 0;

// The browser receives only the cache status. Lyrics stay in Google Sheets and
// are never returned to or rendered by the page.
export function cachePlayingTrackLyrics({ title, artist = '' }) {
  const trackTitle = String(title || '').trim().slice(0, 240);
  const trackArtist = String(artist || '').trim().slice(0, 180);
  if (!trackTitle) return Promise.resolve({ status: 'SIN_TITULO', cached: false });

  return new Promise((resolve, reject) => {
    const callbackName = `__memoriaVivaLyrics${Date.now()}_${requestId++}`;
    const script = document.createElement('script');
    const url = new URL(googleSheetsConfig.endpoint);
    let settled = false;

    url.searchParams.set('action', 'lyrics');
    url.searchParams.set('title', trackTitle);
    url.searchParams.set('artist', trackArtist);
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
      finish(reject, new Error('Apps Script tardó demasiado al revisar las letras.'));
    }, 38000);

    window[callbackName] = response => {
      if (!response?.ok) {
        finish(reject, new Error(response?.error || 'No se pudo guardar el estado de la letra.'));
        return;
      }
      finish(resolve, { status: response.status || 'DESCONOCIDO', cached: Boolean(response.cached) });
    };
    script.async = true;
    script.src = url.href;
    script.onerror = () => finish(reject, new Error('No se pudo consultar la hoja CANCIONES.'));
    document.head.append(script);
  });
}
