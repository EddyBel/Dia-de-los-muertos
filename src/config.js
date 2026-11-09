// URL de la implementación web de Apps Script (termina en /exec).
export const googleSheetsConfig = {
  endpoint:
    "https://script.google.com/macros/s/AKfycbxMb1G8gRJIFgcPZ9Q_r7gkVtjwMO4bGvZmnvJXU2bpjluE70MUN1m8j3NEhTCBptkM/exec",
};

// Acepta una URL de video o una playlist de YouTube (con ?list=...).
// La reproducción aleatoria aplica cuando la URL contiene una playlist.
export const ambientMusicConfig = {
  url: 'https://www.youtube.com/playlist?list=PLOBBjJ_ki75w',
  volume: 22,
  autoplay: true,
};
