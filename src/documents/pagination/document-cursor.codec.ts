import { z } from 'zod';
import { parseJson } from '../../common/json/parse-json.js';
import { DocumentPageCursor } from '../domain/document-page.js';

const cursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().min(1),
});

/**
 * Convierte el cursor en un texto opaco para el cliente (base64url) y de vuelta.
 * El cliente no debe interpretarlo, así que su contenido puede cambiar sin romperlo.
 */
export const documentCursorCodec = {
  encode(cursor: DocumentPageCursor): string {
    const payload = {
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  },

  /** Devuelve null si el texto no es un cursor válido. */
  decode(encoded: string): DocumentPageCursor | null {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = cursorPayloadSchema.safeParse(parseJson(json));
    if (!parsed.success) {
      return null;
    }
    return { createdAt: new Date(parsed.data.createdAt), id: parsed.data.id };
  },
};
