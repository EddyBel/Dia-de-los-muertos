import { googleSheetsConfig } from '../config.js';

const sessionId = globalThis.crypto?.randomUUID?.()
  || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const startedAt = Date.now();
let metadataPromise;

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  return 'Desconocido';
}

function detectOS(ua) {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Desconocido';
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|auth|secret|password|passwd|email|session|credential|^code$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = '';
    return url.toString().slice(0, 1500);
  } catch {
    return '';
  }
}

function getMetadata() {
  if (metadataPromise) return metadataPromise;
  metadataPromise = (async () => {
    const ua = navigator.userAgent || '';
    const uaData = navigator.userAgentData;
    let browser = detectBrowser(ua);
    let operatingSystem = uaData?.platform || detectOS(ua);
    if (uaData?.brands?.length) {
      const brand = uaData.brands.find(item => !/not.?a.?brand/i.test(item.brand));
      if (brand) browser = brand.brand;
    }
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let timezone = '';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* Sin zona horaria disponible. */ }

    return {
      timezone,
      language: navigator.language || '',
      preferredLanguages: Array.from(navigator.languages || []).join(', '),
      operatingSystem: String(operatingSystem).slice(0, 120),
      browser: String(browser).slice(0, 120),
      userAgent: ua.slice(0, 1000),
      userAgentClientHints: uaData?.brands
        ? JSON.stringify({ brands: uaData.brands, mobile: uaData.mobile, platform: uaData.platform }).slice(0, 1000)
        : '',
      screenResolution: `${screen.width}x${screen.height}`,
      viewport: `${innerWidth}x${innerHeight}`,
      connection: connection ? JSON.stringify({
        type: connection.type || '',
        effectiveType: connection.effectiveType || '',
        downlink: Number.isFinite(connection.downlink) ? connection.downlink : '',
        rtt: Number.isFinite(connection.rtt) ? connection.rtt : '',
        saveData: Boolean(connection.saveData),
      }) : 'No disponible',
      online: navigator.onLine,
      referrer: sanitizeUrl(document.referrer).slice(0, 1000),
      sourceUrl: sanitizeUrl(location.href),
    };
  })();
  return metadataPromise;
}

function send(payload) {
  if (!googleSheetsConfig.endpoint.startsWith('https://script.google.com/macros/s/')) return;
  const body = JSON.stringify({ action: 'event', sessionId, ...payload });
  if (navigator.sendBeacon) {
    const queued = navigator.sendBeacon(
      googleSheetsConfig.endpoint,
      new Blob([body], { type: 'text/plain;charset=UTF-8' }),
    );
    if (queued) return;
  }
  fetch(googleSheetsConfig.endpoint, {
    method: 'POST',
    mode: 'no-cors',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
  }).catch(error => console.warn('No se pudo guardar el evento de uso:', error));
}

export function createSessionTelemetry() {
  let consentGranted = false;
  const pendingEvents = [];
  function recordUsageEvent(eventName, details = {}, durationMs = Date.now() - startedAt, timestamp = new Date().toISOString()) {
    const event = { eventName, details, durationMs, timestamp };
    if (!consentGranted) {
      pendingEvents.push(event);
      return;
    }
    getMetadata().then(metadata => send({
      eventName,
      clientTimestamp: timestamp,
      sessionDurationMs: durationMs,
      metadata,
      ...details,
    }));
  }

  recordUsageEvent('page_view');
  let formStarted = false;
  let completed = false;
  let ended = false;
  let abandoned = false;

  return {
    grantConsent() {
      if (consentGranted) return;
      consentGranted = true;
      pendingEvents.splice(0).forEach(event => {
        recordUsageEvent(event.eventName, event.details, event.durationMs, event.timestamp);
      });
    },
    startForm() {
      if (formStarted || completed) return;
      abandoned = false;
      formStarted = true;
      recordUsageEvent('form_started');
    },
    stepCompleted(step) {
      recordUsageEvent('step_completed', { step });
    },
    photoAdded(count, totalBytes) {
      recordUsageEvent('photo_added', { photoCount: count, photoBytes: totalBytes });
    },
    photoRemoved(count, totalBytes) {
      recordUsageEvent('photo_removed', { photoCount: count, photoBytes: totalBytes });
    },
    submissionSuccess() {
      completed = true;
      recordUsageEvent('submission_success');
    },
    submissionError(errorMessage) {
      recordUsageEvent('submission_error', { message: String(errorMessage || '').slice(0, 500) });
    },
    abandonForm() {
      if (!formStarted || completed || abandoned) return;
      abandoned = true;
      formStarted = false;
      recordUsageEvent('form_abandoned');
    },
    getSessionId() { return sessionId; },
    getDurationMs() { return Date.now() - startedAt; },
    async getMetadata() { return getMetadata(); },
    finish() {
      if (ended) return;
      ended = true;
      const duration = Date.now() - startedAt;
      if (formStarted && !completed) this.abandonForm();
      recordUsageEvent('session_duration', { sessionDurationMs: duration });
    },
  };
}
