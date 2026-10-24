import { FileTypeValidator, ParseFilePipe } from '@nestjs/common';
import { ALLOWED_MIME_TYPES } from '../documents.constants.js';

const ALLOWED_MIME_TYPE_PATTERN = new RegExp(
  `^(${ALLOWED_MIME_TYPES.map(escapeRegExp).join('|')})$`,
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Exige un archivo y revisa su tipo real por los magic bytes. El límite de tamaño
 * lo aplica antes Multer, así un archivo demasiado grande nunca llega a memoria.
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
