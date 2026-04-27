import imageCompression from 'browser-image-compression';

const DEFAULT_OPTS = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.82,
  fileType: 'image/webp',
} as const;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const compressed = await imageCompression(file, DEFAULT_OPTS);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}.webp`;
    return new File([compressed], newName, { type: 'image/webp' });
  } catch {
    return file;
  }
}
