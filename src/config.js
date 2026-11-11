// URL de la implementación web de Apps Script (termina en /exec).
export const googleSheetsConfig = {
  endpoint:
    "https://script.google.com/macros/s/AKfycbxMb1G8gRJIFgcPZ9Q_r7gkVtjwMO4bGvZmnvJXU2bpjluE70MUN1m8j3NEhTCBptkM/exec",
};

export const ambientMusicConfig = {
  manifestUrl: new URL('../public/musica/playlist.json', import.meta.url).href,
  volume: 0.22,
  autoplay: true,
};
