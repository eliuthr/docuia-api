/**
 * Persists raw document files. Abstract class instead of interface so Nest can
 * use it as an injection token.
 */
export abstract class StorageProvider {
  abstract save(key: string, content: Buffer): Promise<void>;
  abstract delete(key: string): Promise<void>;
}
