export const UPLOAD_FIELD_NAME = 'file';

export const BYTES_PER_MEGABYTE = 1024 * 1024;

export const DEFAULT_LIST_LIMIT = 10;
export const MAX_LIST_LIMIT = 100;
/** Un cursor válido mide unos 100 caracteres; el tope evita decodificar textos enormes. */
export const MAX_CURSOR_LENGTH = 512;

/** Tipos MIME aceptados y la extensión con la que se guarda cada archivo. */
export const FILE_EXTENSION_BY_MIME_TYPE: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

export const ALLOWED_MIME_TYPES = Object.keys(FILE_EXTENSION_BY_MIME_TYPE);
