const SPREADSHEET_ID = "1LwZET_i9KXWiDlr6JxhBDfXIXYUcd2hzwW_vQl1lpIQ";
const SHEET_NAME = "RESPUESTAS";
const LYRICS_SHEET_NAME = "CANCIONES";
const LYRICS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_LYRICS_CELL_CHARS = 45000;
const LYRICS_HEADERS = [
  "Fecha y hora",
  "Nombre en YouTube",
  "Artista",
  "Nombre LRCLIB",
  "Letra sincronizada",
  "Status",
  "Letra sin marcas de tiempo",
  "Artista consultado (clave)",
];
const MAX_EMAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const EMAIL_VIEWS = [
  { id: "frontal", label: "Vista frontal" },
  { id: "tres-cuartos-derecha", label: "Tres cuartos derecha" },
  { id: "tres-cuartos-izquierda", label: "Tres cuartos izquierda" },
  { id: "picado", label: "Vista picada" },
  { id: "contrapicado", label: "Vista contrapicada" },
];

// Ejecuta esta función desde el editor una vez para autorizar MailApp.
function authorizeMailApp() {
  MailApp.getRemainingDailyQuota();
}

// Ejecuta una vez desde el editor para autorizar UrlFetchApp y crear CANCIONES.
function authorizeLyricsLookup() {
  UrlFetchApp.fetch("https://lrclib.net/api/search?track_name=Memoria%20Viva", {
    muteHttpExceptions: true,
    headers: {
      "X-User-Agent": "MemoriaVivaOfrenda/1.0 (https://github.com/EddyBel/Dia-de-los-muertos)",
    },
  });
  getLyricsSheet_();
}

// Devuelve solo el total de registros, para que el Hero actualice sus flores.
// La respuesta JSONP permite leer el conteo desde GitHub Pages sin abrir datos
// personales ni depender de CORS entre dominios.

function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};

  if (parameters.action === "lyrics") {
    try {
      return jsonpResponse(
        getLyricsForTrack_(parameters.title, parameters.artist),
        parameters.callback,
      );
    } catch (error) {
      console.error("[LYRICS ERROR]", error);
      return jsonpResponse(
        { ok: false, error: "No se pudo consultar la hoja CANCIONES." },
        parameters.callback,
      );
    }
  }

  if (parameters.action !== "count") {
    return jsonpResponse({
      ok: false,
      error: "Acción no válida",
      received: parameters.action || null,
    }, parameters.callback);
  }

  try {
    console.log("[COUNT] Abriendo Spreadsheet:", SPREADSHEET_ID);

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log("[COUNT] Spreadsheet abierto:", spreadsheet.getName());

    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(
        'No existe la pestaña "' +
          SHEET_NAME +
          '". Pestañas disponibles: ' +
          spreadsheet
            .getSheets()
            .map((s) => s.getName())
            .join(", "),
      );
    }

    console.log("[COUNT] Pestaña encontrada:", sheet.getName());

    const lastRow = sheet.getLastRow();
    console.log("[COUNT] Última fila:", lastRow);

    let count = 0;

    if (lastRow > 1) {
      const rows = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();

      count = rows.filter(
        (row) => row[0].trim() && row[1].trim() && row[2].trim(),
      ).length;
    }

    console.log("[COUNT] Total de registros:", count);

    return jsonpResponse({
      ok: true,
      count: count,
      lastRow: lastRow,
      spreadsheet: spreadsheet.getName(),
      sheet: sheet.getName(),
    }, parameters.callback);
  } catch (error) {
    const detail = String(error && error.stack ? error.stack : error);

    console.error("[COUNT ERROR]", detail);

    return jsonpResponse({
      ok: false,
      error: detail,
      message: error.message || String(error),
    }, parameters.callback);
  }
}

function getLyricsForTrack_(youtubeTitle, youtubeArtist) {
  const title = String(youtubeTitle || "").trim().slice(0, 240);
  const track = extractYoutubeTrack_(title, youtubeArtist);
  const artist = track.artist.slice(0, 180);
  if (!title) return { ok: true, status: "SIN_TITULO", cached: false };

  let sheet;
  const cache = CacheService.getScriptCache();
  const pendingKey = lyricsPendingKey_(title, artist);
  let lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet = getLyricsSheet_();
    const cached = findLyricsCache_(sheet, title, artist);
    if (isLyricsCacheValid_(cached)) {
      return { ok: true, status: cached.status, cached: true };
    }
    if (cache.get(pendingKey)) {
      return { ok: true, status: "PENDIENTE", cached: true };
    }
    cache.put(pendingKey, "1", 120);
  } finally {
    lock.releaseLock();
  }

  let result;
  try {
    result = lookupLyricsAtLrclib_(track.trackTitle, artist);
  } catch (error) {
    console.error("[LRCLIB LOOKUP ERROR]", error);
    result = { status: "ERROR_API", detail: String(error && error.message ? error.message : error) };
  }

  lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet = getLyricsSheet_();
    const cached = findLyricsCache_(sheet, title, artist);
    if (isLyricsCacheValid_(cached)) {
      cache.remove(pendingKey);
      return { ok: true, status: cached.status, cached: true };
    }
    appendLyricsResult_(sheet, title, artist, result);
    cache.remove(pendingKey);
    return { ok: true, status: result.status, cached: false };
  } finally {
    lock.releaseLock();
  }
}

function getLyricsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(LYRICS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(LYRICS_SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LYRICS_HEADERS.length).setValues([LYRICS_HEADERS]);
    return sheet;
  }

  const firstRow = sheet
    .getRange(1, 1, 1, Math.max(LYRICS_HEADERS.length, sheet.getLastColumn()))
    .getDisplayValues()[0]
    .map((value) => String(value).trim().toLowerCase());
  const looksLikeHeader =
    /fecha|date|timestamp/.test(firstRow[0]) &&
    /youtube|cancion|canción|nombre/.test(firstRow[1]);
  if (!firstRow[0]) {
    sheet.getRange(1, 1, 1, LYRICS_HEADERS.length).setValues([LYRICS_HEADERS]);
  } else {
    if (!looksLikeHeader) sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, LYRICS_HEADERS.length).setValues([LYRICS_HEADERS]);
  }
  sheet.hideColumns(8);
  return sheet;
}

function findLyricsCache_(sheet, youtubeTitle, youtubeArtist) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const titleKey = normalizeLyricsKey_(youtubeTitle);
  const artistKey = normalizeLyricsKey_(youtubeArtist);
  const rows = sheet.getRange(2, 1, lastRow - 1, LYRICS_HEADERS.length).getValues();
  let latest = null;
  let latestSuccess = null;

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (
      normalizeLyricsKey_(row[1]) !== titleKey ||
      normalizeLyricsKey_(row[7]) !== artistKey
    ) continue;

    const record = { date: row[0], status: String(row[5] || "") };
    if (!latest) latest = record;
    if (record.status.indexOf("ENCONTRADA_") === 0) {
      latestSuccess = record;
      break;
    }
  }
  return latestSuccess || latest;
}

function lyricsPendingKey_(title, artist) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalizeLyricsKey_(title) + "|" + normalizeLyricsKey_(artist),
  );
  return "lyrics_pending_" + Utilities.base64EncodeWebSafe(digest).slice(0, 36);
}

function isLyricsCacheValid_(cached) {
  if (!cached) return false;
  if (cached.status.indexOf("ENCONTRADA_") === 0) return true;
  // Authorization failures are configuration problems, not LRCLIB results;
  // retry immediately after the owner grants UrlFetchApp permission.
  if (/permiso|permission|authorization|autorizaci[oó]n/i.test(cached.status)) return false;
  const checkedAt = cached.date instanceof Date ? cached.date.getTime() : new Date(cached.date).getTime();
  return Number.isFinite(checkedAt) && Date.now() - checkedAt < LYRICS_CACHE_TTL_MS;
}

function normalizeLyricsKey_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function appendLyricsResult_(sheet, youtubeTitle, youtubeArtist, result) {
  const syncedLyrics = String(result.syncedLyrics || "");
  const plainLyrics = String(result.plainLyrics || "");
  let status = result.status;
  if (result.detail) status += ": " + String(result.detail).slice(0, 220);
  if (
    syncedLyrics.length > MAX_LYRICS_CELL_CHARS ||
    plainLyrics.length > MAX_LYRICS_CELL_CHARS
  ) {
    status = "ERROR_LIMITE_HOJA";
  }

  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, LYRICS_HEADERS.length).setValues([[
    new Date(),
    youtubeTitle,
    result.artistName || youtubeArtist,
    result.trackName || "",
    status === "ERROR_LIMITE_HOJA" ? "" : syncedLyrics,
    status,
    status === "ERROR_LIMITE_HOJA" ? "" : plainLyrics,
    youtubeArtist,
  ]]);
  sheet.getRange(row, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
}

function lookupLyricsAtLrclib_(trackTitle, youtubeArtist) {
  const normalizedTitle = cleanYoutubeTrackTitle_(trackTitle);
  if (!normalizedTitle) return { status: "SIN_LETRA" };

  if (youtubeArtist) {
    const exactUrl =
      "https://lrclib.net/api/get?track_name=" +
      encodeURIComponent(normalizedTitle) +
      "&artist_name=" +
      encodeURIComponent(youtubeArtist);
    const exactResponse = fetchLrclib_(exactUrl);
    if (exactResponse.status === 200) {
      const record = parseLrclibRecord_(exactResponse.body);
      if (record) return toLyricsResult_(record);
      return { status: "ERROR_API_RESPUESTA" };
    }
    if (exactResponse.status !== 404 && exactResponse.status !== 0) {
      return { status: "ERROR_API_" + exactResponse.status };
    }
    if (exactResponse.status === 0) Utilities.sleep(400);
    else Utilities.sleep(300);
  }

  const params = ["track_name=" + encodeURIComponent(normalizedTitle)];
  if (youtubeArtist) params.push("artist_name=" + encodeURIComponent(youtubeArtist));
  const searchResponse = fetchLrclib_("https://lrclib.net/api/search?" + params.join("&"));
  if (searchResponse.status !== 200) {
    return {
      status: searchResponse.status === 0 ? "ERROR_API_CONEXION" : "ERROR_API_" + searchResponse.status,
      detail: searchResponse.error || "LRCLIB no respondió correctamente.",
    };
  }

  let candidates;
  try {
    candidates = JSON.parse(searchResponse.body);
  } catch (error) {
    return { status: "ERROR_API_RESPUESTA", detail: "LRCLIB devolvió un JSON inválido." };
  }
  if (!Array.isArray(candidates)) return { status: "ERROR_API_RESPUESTA" };

  const match = chooseLrclibMatch_(candidates, normalizedTitle, youtubeArtist);
  return match ? toLyricsResult_(match) : { status: "SIN_LETRA" };
}

function fetchLrclib_(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      headers: {
        "X-User-Agent": "MemoriaVivaOfrenda/1.0 (https://github.com/EddyBel/Dia-de-los-muertos)",
      },
    });
    return { status: response.getResponseCode(), body: response.getContentText() };
  } catch (error) {
    console.error("[LRCLIB FETCH ERROR]", error);
    return {
      status: 0,
      body: "",
      error: String(error && error.message ? error.message : error).slice(0, 220),
    };
  }
}

function parseLrclibRecord_(body) {
  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

function chooseLrclibMatch_(candidates, title, artist) {
  const titleKey = normalizeLyricsKey_(title);
  const artistKey = normalizeLyricsKey_(artist);
  let best = null;
  let bestScore = -Infinity;

  candidates.forEach((candidate) => {
    const candidateTitle = normalizeLyricsKey_(candidate.trackName || candidate.name);
    if (!candidateTitle) return;
    const titleExact = candidateTitle === titleKey;
    const titleContains = candidateTitle.indexOf(titleKey) >= 0 || titleKey.indexOf(candidateTitle) >= 0;
    const titleTokens = titleKey.split(" ").filter((token) => token.length > 1);
    const overlap = titleTokens.filter((token) => candidateTitle.split(" ").indexOf(token) >= 0).length;
    const matchRatio = titleTokens.length ? overlap / titleTokens.length : 0;
    const candidateArtist = normalizeLyricsKey_(candidate.artistName);
    let score = titleExact ? 8 : (titleContains ? 5 : matchRatio * 5);
    if (artistKey && candidateArtist === artistKey) score += 5;
    else if (artistKey && candidateArtist) score -= 2;
    if (candidate.syncedLyrics) score += 2;
    else if (candidate.plainLyrics) score += 1;
    if (candidate.instrumental) score -= 2;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return bestScore >= 4 ? best : null;
}

function toLyricsResult_(record) {
  const syncedLyrics = String(record.syncedLyrics || "").trim();
  const plainLyrics = String(record.plainLyrics || "").trim();
  if (record.instrumental || (!syncedLyrics && !plainLyrics)) {
    return {
      status: "SIN_LETRA",
      trackName: record.trackName || record.name || "",
      artistName: record.artistName || "",
    };
  }
  return {
    status: syncedLyrics ? "ENCONTRADA_SYNCED" : "ENCONTRADA_PLAIN",
    trackName: record.trackName || record.name || "",
    artistName: record.artistName || "",
    syncedLyrics: syncedLyrics,
    plainLyrics: plainLyrics,
  };
}

function cleanYoutubeTrackTitle_(title) {
  return String(title || "")
    .replace(/[[(](?:official|lyrics?|audio|music video|lyric video|visuali[sz]er|hd|4k|live|video)[^\])]*[\])]/gi, " ")
    .replace(/\s*[-|–]\s*(?:official.*|lyrics?|audio|music video|lyric video|visuali[sz]er)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYoutubeTrack_(youtubeTitle, youtubeArtist) {
  const cleaned = cleanYoutubeTrackTitle_(youtubeTitle);
  const parts = cleaned.split(/\s+[–—-]\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0].length <= 90) {
    return {
      artist: parts[0].trim(),
      trackTitle: parts.slice(1).join(" - ").trim(),
    };
  }
  return {
    artist: String(youtubeArtist || "").replace(/\s+-\s+Topic$/i, "").trim(),
    trackTitle: cleaned,
  };
}

function jsonpResponse(value, callback) {
  const callbackName = String(callback || "");
  const validCallback =
    /^[A-Za-z_$][0-9A-Za-z_$]*(?:\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(
      callbackName,
    );
  if (!validCallback) return jsonResponse(value);

  const safeJson = JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return ContentService.createTextOutput(
    callbackName + "(" + safeJson + ");",
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(event) {
  const payload = readRequestPayload(event);
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const dedication = String(payload.dedication || "")
    .trim()
    .slice(0, 180);
  let status = String(payload.status || "NO_ENVIADO")
    .trim()
    .slice(0, 50);
  let message = String(payload.message || "")
    .trim()
    .slice(0, 2000);

  if (
    !name ||
    !email ||
    name.length > 100 ||
    email.length > 200 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonResponse({ ok: false, error: "Datos inválidos" });
  }

  const captures = Array.isArray(payload.captures) ? payload.captures : [];
  if (captures.length) {
    try {
      sendPhotoSessionWithMailApp(name, email, dedication, captures);
      status = "ENVIADO";
      message =
        "MailApp envió el correo desde la cuenta propietaria del Apps Script.";
    } catch (error) {
      status = "ERROR_ENVIO";
      message = String(error && error.message ? error.message : error).slice(
        0,
        2000,
      );
    }
  }

  try {
    appendParticipant(name, email, status, message, dedication);
    return jsonResponse({ ok: true, status: status, message: message });
  } catch (error) {
    console.error("No se pudo escribir la fila en Sheets:", error);
    return jsonResponse({
      ok: false,
      error: "No se pudo guardar el registro en Google Sheets",
    });
  }
}

function readRequestPayload(event) {
  const contents = event && event.postData ? event.postData.contents : "";
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
    throw new Error("Se requieren exactamente cinco capturas para el correo.");
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    throw new Error("La cuenta de Google agotó su cuota diaria de correo.");
  }

  enforceRecipientRateLimit(email);
  let attachmentBytes = 0;
  const captureById = {};
  captures.forEach((capture) => {
    const id = String(capture.id || "");
    const expectedView = EMAIL_VIEWS.find((view) => view.id === id);
    const dataUrl = String(capture.dataUrl || "");
    const match = dataUrl.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!expectedView || !match) {
      throw new Error(
        "Una de las capturas tiene un formato o identificador inválido.",
      );
    }
    const blob = Utilities.newBlob(
      Utilities.base64Decode(match[1]),
      "image/jpeg",
      "ofrenda-" + id + ".jpg",
    );
    attachmentBytes += blob.getBytes().length;
    captureById[id] = {
      id: id,
      label: expectedView.label,
      filename: "ofrenda-" + id + ".jpg",
      blob: blob,
      contentId: "photo_" + id.replace(/-/g, "_"),
    };
  });

  if (Object.keys(captureById).length !== EMAIL_VIEWS.length) {
    throw new Error(
      "Faltan vistas o hay identificadores repetidos en la sesión.",
    );
  }
  if (attachmentBytes > MAX_EMAIL_ATTACHMENT_BYTES) {
    throw new Error(
      "Las cinco imágenes superan el límite preventivo de 20 MB por correo.",
    );
  }

  const inlineImages = {};
  EMAIL_VIEWS.forEach((view) => {
    const capture = captureById[view.id];
    inlineImages[capture.contentId] = capture.blob;
  });
  MailApp.sendEmail(
    email,
    "Tu sesión de fotos de la ofrenda",
    "Preparamos cinco vistas de tu ofrenda. Abre este mensaje en un cliente que admita HTML para verlas.",
    {
      name: "Memoria Viva",
      htmlBody: buildPhotoSessionEmailHtml(
        name,
        email,
        captureById,
        dedication,
      ),
      inlineImages: inlineImages,
    },
  );
}

function enforceRecipientRateLimit(email) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    email.toLowerCase(),
  );
  const key = "mailapp_" + Utilities.base64EncodeWebSafe(digest).slice(0, 32);
  const cache = CacheService.getScriptCache();
  if (cache.get(key)) {
    throw new Error(
      "Ya se envió una solicitud a este correo recientemente. Espera un minuto antes de reintentar.",
    );
  }
  cache.put(key, "1", 60);
}

function buildPhotoSessionEmailHtml(name, email, captures, dedication) {
  const gallery = EMAIL_VIEWS.map((view) => {
    const capture = captures[view.id];
    return (
      '<tr><td style="padding:8px 0 16px;">' +
      '<img src="cid:' +
      escapeHtml(capture.contentId) +
      '" alt="' +
      escapeHtml(view.label) +
      '" ' +
      'style="display:block;width:100%;height:auto;border:0;border-radius:12px;">' +
      '<p style="margin:8px 0 0;color:#d9c6d3;font-size:13px;">' +
      escapeHtml(view.label) +
      "</p>" +
      "</td></tr>"
    );
  }).join("");

  return (
    '<!doctype html><html><body style="margin:0;padding:24px;background:#160d18;color:#fff7e8;font-family:Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#211522;border:1px solid #56394e;border-radius:20px;">' +
    '<tr><td style="padding:30px 28px 12px;text-align:center;color:#f4bd57;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Día de Muertos</td></tr>' +
    '<tr><td style="padding:0 28px 18px;text-align:center;"><h1 style="margin:0;font-family:Georgia,serif;font-size:30px;font-weight:normal;color:#fff7e8;">Tu ofrenda de recuerdos</h1></td></tr>' +
    '<tr><td style="padding:0 28px 20px;color:#f4e6d2;font-size:15px;line-height:1.65;">' +
    "<p>Hola " +
    escapeHtml(name) +
    ",</p><p>Preparamos cinco vistas de tu ofrenda para que puedas conservarlas. Las imágenes están incluidas en este correo.</p>" +
    (dedication
      ? '<p style="margin:18px 0;padding:14px 16px;border-left:3px solid #f4bd57;color:#f4d89d;font-family:Georgia,serif;font-style:italic;">“' +
        escapeHtml(dedication) +
        "”</p>"
      : "") +
    "</td></tr>" +
    '<tr><td style="padding:0 28px 20px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' +
    gallery +
    "</table></td></tr>" +
    '<tr><td style="padding:18px 28px 28px;border-top:1px solid #56394e;color:#bba9b6;font-size:12px;line-height:1.6;">Este mensaje fue enviado a ' +
    escapeHtml(email) +
    " porque se utilizó este correo al crear la ofrenda.</td></tr>" +
    "</table></body></html>"
  );
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function appendParticipant(name, email, status, message, dedication) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet)
    throw new Error("No existe la pestaña configurada: " + SHEET_NAME);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ensureHeaders(sheet);
    sheet.appendRow([
      new Date(),
      name,
      email,
      status,
      String(message).slice(0, 2000),
      String(dedication || "").slice(0, 180),
    ]);
  } finally {
    lock.releaseLock();
  }
}

function ensureHeaders(sheet) {
  const headers = [
    "Fecha",
    "Nombre",
    "Correo",
    "Status",
    "Message",
    "Dedicatoria",
  ];
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const firstRow = sheet
    .getRange(1, 1, 1, Math.max(5, sheet.getLastColumn()))
    .getDisplayValues()[0]
    .map((value) => String(value).trim().toLowerCase());
  const looksLikeHeader =
    /fecha|date|timestamp/.test(firstRow[0]) &&
    /nombre|name/.test(firstRow[1]) &&
    /correo|email/.test(firstRow[2]);
  if (!looksLikeHeader) sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
