const SPREADSHEET_ID = '1LwZET_i9KXWiDlr6JxhBDfXIXYUcd2hzwW_vQl1lpIQ';
const SHEET_NAME = 'Hoja 1';
const MAX_EMAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const EMAIL_VIEWS = [
  { id: 'frontal', label: 'Vista frontal' },
  { id: 'tres-cuartos-derecha', label: 'Tres cuartos derecha' },
  { id: 'tres-cuartos-izquierda', label: 'Tres cuartos izquierda' },
  { id: 'picado', label: 'Vista picada' },
  { id: 'contrapicado', label: 'Vista contrapicada' }
];

// Ejecuta esta función desde el editor una vez para autorizar MailApp.
function authorizeMailApp() {
  MailApp.getRemainingDailyQuota();
}

function doPost(event) {
  const payload = readRequestPayload(event);
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const dedication = String(payload.dedication || '').trim().slice(0, 180);
  let status = String(payload.status || 'NO_ENVIADO').trim().slice(0, 50);
  let message = String(payload.message || '').trim().slice(0, 2000);

  if (!name || !email || name.length > 100 || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Datos inválidos' });
  }

  const captures = Array.isArray(payload.captures) ? payload.captures : [];
  if (captures.length) {
    try {
      sendPhotoSessionWithMailApp(name, email, dedication, captures);
      status = 'ENVIADO';
      message = 'MailApp envió el correo desde la cuenta propietaria del Apps Script.';
    } catch (error) {
      status = 'ERROR_ENVIO';
      message = String(error && error.message ? error.message : error).slice(0, 2000);
    }
  }

  try {
    appendParticipant(name, email, status, message, dedication);
    return jsonResponse({ ok: true, status: status, message: message });
  } catch (error) {
    console.error('No se pudo escribir la fila en Sheets:', error);
    return jsonResponse({ ok: false, error: 'No se pudo guardar el registro en Google Sheets' });
  }
}

function readRequestPayload(event) {
  const contents = event && event.postData ? event.postData.contents : '';
  if (contents) {
    try {
      return JSON.parse(contents);
    } catch (error) {
      // Mantiene compatibilidad con el envío anterior de URLSearchParams.
    }
  }
  return event && event.parameter ? event.parameter : {};
}

function sendPhotoSessionWithMailApp(name, email, dedication, captures) {
  if (captures.length !== EMAIL_VIEWS.length) {
    throw new Error('Se requieren exactamente cinco capturas para el correo.');
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    throw new Error('La cuenta de Google agotó su cuota diaria de correo.');
  }

  enforceRecipientRateLimit(email);
  let attachmentBytes = 0;
  const captureById = {};
  captures.forEach(capture => {
    const id = String(capture.id || '');
    const expectedView = EMAIL_VIEWS.find(view => view.id === id);
    const dataUrl = String(capture.dataUrl || '');
    const match = dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!expectedView || !match) {
      throw new Error('Una de las capturas tiene un formato o identificador inválido.');
    }
    const blob = Utilities.newBlob(
      Utilities.base64Decode(match[1]),
      'image/jpeg',
      'ofrenda-' + id + '.jpg'
    );
    attachmentBytes += blob.getBytes().length;
    captureById[id] = {
      id: id,
      label: expectedView.label,
      filename: 'ofrenda-' + id + '.jpg',
      blob: blob,
      contentId: 'photo_' + id.replace(/-/g, '_')
    };
  });

  if (Object.keys(captureById).length !== EMAIL_VIEWS.length) {
    throw new Error('Faltan vistas o hay identificadores repetidos en la sesión.');
  }
  if (attachmentBytes > MAX_EMAIL_ATTACHMENT_BYTES) {
    throw new Error('Las cinco imágenes superan el límite preventivo de 20 MB por correo.');
  }

  const inlineImages = {};
  EMAIL_VIEWS.forEach(view => {
    const capture = captureById[view.id];
    inlineImages[capture.contentId] = capture.blob;
  });
  MailApp.sendEmail(email, 'Tu sesión de fotos de la ofrenda',
    'Preparamos cinco vistas de tu ofrenda. Abre este mensaje en un cliente que admita HTML para verlas.', {
      name: 'Memoria Viva',
      htmlBody: buildPhotoSessionEmailHtml(name, email, captureById, dedication),
      inlineImages: inlineImages
    }
  );
}

function enforceRecipientRateLimit(email) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email.toLowerCase());
  const key = 'mailapp_' + Utilities.base64EncodeWebSafe(digest).slice(0, 32);
  const cache = CacheService.getScriptCache();
  if (cache.get(key)) {
    throw new Error('Ya se envió una solicitud a este correo recientemente. Espera un minuto antes de reintentar.');
  }
  cache.put(key, '1', 60);
}

function buildPhotoSessionEmailHtml(name, email, captures, dedication) {
  const gallery = EMAIL_VIEWS.map(view => {
    const capture = captures[view.id];
    return '<tr><td style="padding:8px 0 16px;">' +
      '<img src="cid:' + escapeHtml(capture.contentId) + '" alt="' + escapeHtml(view.label) + '" ' +
      'style="display:block;width:100%;height:auto;border:0;border-radius:12px;">' +
      '<p style="margin:8px 0 0;color:#d9c6d3;font-size:13px;">' + escapeHtml(view.label) + '</p>' +
      '</td></tr>';
  }).join('');

  return '<!doctype html><html><body style="margin:0;padding:24px;background:#160d18;color:#fff7e8;font-family:Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#211522;border:1px solid #56394e;border-radius:20px;">' +
    '<tr><td style="padding:30px 28px 12px;text-align:center;color:#f4bd57;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Día de Muertos</td></tr>' +
    '<tr><td style="padding:0 28px 18px;text-align:center;"><h1 style="margin:0;font-family:Georgia,serif;font-size:30px;font-weight:normal;color:#fff7e8;">Tu ofrenda de recuerdos</h1></td></tr>' +
    '<tr><td style="padding:0 28px 20px;color:#f4e6d2;font-size:15px;line-height:1.65;">' +
    '<p>Hola ' + escapeHtml(name) + ',</p><p>Preparamos cinco vistas de tu ofrenda para que puedas conservarlas. Las imágenes están incluidas en este correo.</p>' +
    (dedication ? '<p style="margin:18px 0;padding:14px 16px;border-left:3px solid #f4bd57;color:#f4d89d;font-family:Georgia,serif;font-style:italic;">“' + escapeHtml(dedication) + '”</p>' : '') + '</td></tr>' +
    '<tr><td style="padding:0 28px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' + gallery + '</table></td></tr>' +
    '<tr><td style="padding:18px 28px 28px;border-top:1px solid #56394e;color:#bba9b6;font-size:12px;line-height:1.6;">Este mensaje fue enviado a ' + escapeHtml(email) + ' porque se utilizó este correo al crear la ofrenda.</td></tr>' +
    '</table></body></html>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function appendParticipant(name, email, status, message, dedication) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('No existe la pestaña configurada: ' + SHEET_NAME);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ensureHeaders(sheet);
    sheet.appendRow([new Date(), name, email, status, String(message).slice(0, 2000), String(dedication || '').slice(0, 180)]);
  } finally {
    lock.releaseLock();
  }
}

function ensureHeaders(sheet) {
  const headers = ['Fecha', 'Nombre', 'Correo', 'Status', 'Message', 'Dedicatoria'];
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, Math.max(5, sheet.getLastColumn())).getDisplayValues()[0]
    .map(value => String(value).trim().toLowerCase());
  const looksLikeHeader =
    /fecha|date|timestamp/.test(firstRow[0]) &&
    /nombre|name/.test(firstRow[1]) &&
    /correo|email/.test(firstRow[2]);
  if (!looksLikeHeader) sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
