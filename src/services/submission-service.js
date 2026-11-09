import { googleSheetsConfig } from '../config.js';

export function isSubmissionServiceConfigured() {
  return googleSheetsConfig.endpoint.startsWith('https://script.google.com/macros/s/') &&
    googleSheetsConfig.endpoint.endsWith('/exec');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo preparar una captura.'));
    reader.readAsDataURL(blob);
  });
}

// Apps Script guarda el registro y envía las capturas con MailApp desde la
// cuenta Google propietaria, sin exponer credenciales en GitHub Pages.
export async function submitOfrenda({ name, email, dedication = '', status, message = '', captures = [], sessionId = '', metadata = {}, sessionDurationMs = 0 }) {
  if (!isSubmissionServiceConfigured()) {
    throw new Error('El servicio de envío no está configurado.');
  }

  const encodedCaptures = [];
  for (const capture of captures) {
    encodedCaptures.push({
      id: capture.id,
      label: capture.label,
      filename: capture.filename,
      contentId: capture.parameterName,
      dataUrl: await blobToDataUrl(capture.blob)
    });
  }

  await fetch(googleSheetsConfig.endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ name, email, dedication, status, message, captures: encodedCaptures, sessionId, metadata, sessionDurationMs })
  });
}
