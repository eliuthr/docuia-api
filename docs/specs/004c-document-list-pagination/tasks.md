# 004c — Document list pagination: tasks

- [x] **T1** Domain types, `DocumentCursorCodec` + tests. (AC-4, NFR-1)
- [x] **T2** `DocumentRepository.findPage` (Mongo + in-memory), index, cursor filter + tests.
      (AC-2, AC-3, AC-5, NFR-2)
- [x] **T3** Service, query DTO, response DTO, controller, Swagger + tests. (AC-1, AC-4)
- [x] **T4** e2e; README; lint, tests, e2e, build.

## Verification log

- 2026-10-24 — lint clean; 190 unit tests and 28 e2e tests pass; build OK.
- e2e walks 25 documents created at once (several share a millisecond) in pages of 10: no
  duplicates, every document seen, last page `nextCursor: null`.
- Manual check against MongoDB: `GET /documents?limit=10` returns 10 items and a cursor; the web
  client moved to page 2 with it and back.
- Implementation notes:
  - `toDocumentPage` (domain) builds the page from `limit + 1` sorted documents and is shared by
    the Mongo repository and the in-memory fake, so both decide "has more" the same way.
  - The default page size changed from 20 to 10.
