const DEFAULT_OPTS = {
  maxSizeMB: 0.6,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  initialQuality: 0.82,
  fileType: 'image/webp',
} as const;

export function addWatermark(file: File, lat?: number, lng?: number): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(objectUrl); resolve(file); return; }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      const barH = Math.max(44, Math.round(img.naturalHeight * 0.065));
      const fontSize = Math.max(13, Math.round(barH * 0.38));
      const pad = Math.round(fontSize * 0.7);

      // semi-transparent dark bar
      ctx.fillStyle = 'rgba(0,0,0,0.58)';
      ctx.fillRect(0, img.naturalHeight - barH, img.naturalWidth, barH);

      // white text
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      ctx.textBaseline = 'middle';

      const now = new Date();
      const date = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const coord = lat != null && lng != null ? `  ${lat.toFixed(5)}, ${lng.toFixed(5)}` : '';
      ctx.fillText(`${date}  ${time}${coord}`, pad, img.naturalHeight - barH / 2);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const base = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${base}.webp`, { type: 'image/webp' }));
        },
        'image/webp',
        0.9,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const { default: imageCompression } = await import('browser-image-compression');
    const compressed = await imageCompression(file, DEFAULT_OPTS);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}.webp`;
    return new File([compressed], newName, { type: 'image/webp' });
  } catch {
    return file;
  }
}
