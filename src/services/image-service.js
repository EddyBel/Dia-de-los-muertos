export async function decodeImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Formato de imagen inválido');
  }

  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function closeImages(images) {
  images.forEach(image => image.close?.());
}

export function validatePhotoFiles(files) {
  if (files.length > 3) return 'Puedes seleccionar máximo 3 fotografías.';

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (files.some(file => !validTypes.includes(file.type))) {
    return 'Solo se permiten fotografías JPG, PNG o WebP.';
  }

  if (files.some(file => file.size > 12 * 1024 * 1024)) {
    return 'Cada fotografía debe pesar menos de 12 MB.';
  }

  return null;
}

