# 004c — Document list pagination: design

## Keyset pagination

Documents are sorted by `(createdAt desc, id desc)`; `id` breaks ties between documents created
in the same millisecond. A cursor is the sort key of the last document of a page, and the next
page asks for documents strictly "after" it in that order:

```
createdAt < cursor.createdAt  OR  (createdAt = cursor.createdAt AND id < cursor.id)
```

The repository reads `limit + 1` documents: if the extra one exists, there is a next page and its
cursor is the key of the last document returned.

## Types

```ts
interface DocumentPageCursor { createdAt: Date; id: string }        // domain, typed
interface DocumentPageRequest { limit: number; after: DocumentPageCursor | null }
interface DocumentPage { documents: DocumentEntity[]; nextCursor: DocumentPageCursor | null }

DocumentRepository.findPage(request): Promise<DocumentPage>   // replaces findRecent(limit)
```

`DocumentCursorCodec` turns a cursor into the opaque string and back:
`base64url(JSON.stringify({ createdAt: ISO, id }))`, validated with Zod when decoding. The
service throws `BadRequestException('Invalid cursor')` when decoding fails.

## API

| Query    | Type                  | Default |
| -------- | --------------------- | ------- |
| `limit`  | int 1–100             | 10      |
| `cursor` | string, max 512 chars | —       |

Response: `DocumentPageResponseDto { items: DocumentResponseDto[]; nextCursor: string | null }`.

"Previous" is handled by the client, which remembers the cursors of the pages it visited; the API
only moves forward. This matches DynamoDB's `ExclusiveStartKey`.

## Testing strategy

- Unit: codec (round trip, malformed input), service (decodes the cursor, encodes the next one,
  400 on invalid), Mongo filter for the cursor.
- e2e: three pages over 25 documents with no duplicates or gaps, last page `nextCursor: null`,
  invalid cursor `400`, invalid limit `400`.
