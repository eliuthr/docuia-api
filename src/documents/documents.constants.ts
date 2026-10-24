export const UPLOAD_FIELD_NAME = 'file';

export const BYTES_PER_MEGABYTE = 1024 * 1024;

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

/** Tipos MIME aceptados y la extensión con la que se guarda cada archivo. */
export const FILE_EXTENSION_BY_MIME_TYPE: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

export const ALLOWED_MIME_TYPES = Object.keys(FILE_EXTENSION_BY_MIME_TYPE);
