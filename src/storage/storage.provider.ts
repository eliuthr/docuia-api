/**
 * Guarda los archivos originales de los documentos. Es una clase abstracta y no
 * una interfaz para que Nest pueda usarla como token de inyección.
 */
export abstract class StorageProvider {
  abstract save(key: string, content: Buffer): Promise<void>;
  abstract read(key: string): Promise<Buffer>;
  abstract delete(key: string): Promise<void>;
}
