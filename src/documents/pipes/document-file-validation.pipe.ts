import { FileTypeValidator, ParseFilePipe } from '@nestjs/common';
import { ALLOWED_MIME_TYPES } from '../documents.constants.js';

const ALLOWED_MIME_TYPE_PATTERN = new RegExp(
  `^(${ALLOWED_MIME_TYPES.map(escapeRegExp).join('|')})$`,
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Requires a file and checks its real type from the magic bytes. The size limit
 * is enforced earlier by Multer so oversized uploads never reach memory.
 */
export const documentFileValidationPipe = new ParseFilePipe({
  fileIsRequired: true,
  validators: [
    new FileTypeValidator({
      fileType: ALLOWED_MIME_TYPE_PATTERN,
      overrideMimeType: true,
    }),
  ],
});
