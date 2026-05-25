const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\r\n]+/g;

export function buildAttachmentContentDisposition(fileName?: string) {
  const normalized = sanitizeFileName(fileName || 'file');
  const asciiFallback = normalized
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(INVALID_FILENAME_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'file';
  const encodedUtf8Name = encodeURIComponent(normalized).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8Name}`;
}

function sanitizeFileName(value: string) {
  return value
    .replace(INVALID_FILENAME_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'file';
}
