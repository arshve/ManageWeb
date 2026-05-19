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

      const fontSize = Math.max(14, Math.round(img.naturalHeight * 0.022));
      const lineGap = Math.round(fontSize * 0.35);
      const barH = fontSize * 2 + lineGap * 3;
      const pad = Math.round(fontSize * 0.6);

      // semi-transparent dark bar
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, img.naturalHeight - barH, img.naturalWidth, barH);

      const now = new Date();
      const date = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const coordText = lat != null && lng != null
        ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        : 'koordinat tidak tersedia';

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';

      // line 1 — date + time
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      ctx.fillText(`${date}  ${time}`, pad, img.naturalHeight - barH + lineGap);

      // line 2 — coordinates (slightly smaller)
      const coordSize = Math.max(12, Math.round(fontSize * 0.85));
      ctx.font = `${coordSize}px "Courier New", monospace`;
      ctx.fillStyle = lat != null ? '#ffffff' : 'rgba(255,255,255,0.6)';
      ctx.fillText(coordText, pad, img.naturalHeight - barH + lineGap + fontSize + lineGap);

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

export function toThumbnailUrl(url: string, size = 80): string {
  if (!url.includes('/storage/v1/object/public/')) return url;
  return url
    .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    + `?width=${size}&height=${size}&resize=cover&quality=70`;
}

export async function compressImage(file: File): Promise<File> {
  const isImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
  if (!isImage) return file;
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
