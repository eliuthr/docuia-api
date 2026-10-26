# 004c — Document list pagination: requirements

> Follow-up to spec 001 (list endpoint), numbered 004c so later specs keep their roadmap numbers.

## Context

`GET /documents` returns the newest documents up to a limit, with no way to see older ones. The
web client needs pages of 10 with "Previous" and "Next". The data store moves to DynamoDB in
spec 006, which pages with a cursor ("start after this key") and cannot count or skip cheaply, so
the API uses cursor (keyset) pagination from now on.

## Acceptance criteria

- **AC-1** `GET /documents?limit=N` SHALL respond `{ items, nextCursor }` with at most `N`
  documents (default 10, max 100), newest first.
- **AC-2** WHEN more documents exist after the page, `nextCursor` SHALL be an opaque string; WHEN
  the page is the last one, it SHALL be `null`.
- **AC-3** `GET /documents?cursor=…` SHALL return the documents that come right after the ones of
  the previous page, with no duplicates or gaps even when several documents share the same
  `createdAt`.
- **AC-4** WHEN the cursor is malformed, THE SYSTEM SHALL respond `400`.
- **AC-5** Documents uploaded after the first page was loaded SHALL NOT shift later pages
  (unlike offset pagination).

## Non-functional requirements

- **NFR-1** The cursor is opaque to clients (base64url); its contents can change without breaking
  them.
- **NFR-2** MongoDB uses an index on `{ createdAt: -1, _id: -1 }` that matches the sort.
- **NFR-3** This is a breaking change to the list response (array → object); the only client is
  `docuia-web`, updated in its spec 005.
