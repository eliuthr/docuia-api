# 004 — Questions and tool calling: tasks

- [x] **T1** `AGENT_MAX_ITERATIONS` + validation tests; `.env.example`.
- [x] **T2** Summary: `DocumentOverviewService` + prompt, `summary` in entity, record, repository,
      DTO; drop `summary` from `contractSchema`; tests. (AC-5.1, AC-5.2)
- [x] **T3** `DocumentRepository.search` (Mongo + in-memory) + tests.
- [x] **T4** `LlmProvider.streamTurn` + OpenAI implementation + tests. (NFR-1)
- [x] **T5** `LlmTool`, `ToolRegistry` + tests. (AC-3.2, NFR-4)
- [x] **T6** The four tools + tests. (AC-2.2, AC-3.1, AC-3.3, AC-3.5)
- [x] **T7** `ToolLoopService` + tests. (AC-3.4, NFR-5)
- [x] **T8** Prompts, `QuestionAnsweringService`, `QuestionsController` (SSE), DTO, Swagger,
      `QuestionsModule` + tests. (US-1, US-2, US-4)
- [x] **T9** e2e with a scripted fake LLM; README; lint, tests, e2e, build.
- [x] **T10** Manual run with the real API and the sample documents.

## Verification log

- 2026-10-24 — lint clean; 165 unit tests and 25 e2e tests pass; build OK.
- Probe before implementing: `gpt-6-luna` returns a plain `function_call` item and no reasoning
  items, so the neutral conversation format needs no provider-specific state.
- Manual run against the real OpenAI API (`gpt-6-luna`), Docker MongoDB + Redis, API and worker:
  - The four sample documents (`docuia/docs/documentos-prueba`, outside the repo) were reprocessed
    and each got an accurate summary of up to three sentences, including the receipt image.
  - `POST /ask` "How much do all my invoices add up to, by currency?" →
    `find_documents → sum_invoice_totals`; 2.746.725 COP over 3 invoices and 150 USD over 1,
    matching the hand-calculated totals; the answer named the documents used. 70 SSE events
    (67 `delta`), ending with `done`.
  - Contract: "How is it paid, and is there an employment relationship?" →
    `get_document_details → search_document_text`; 40 % on signing, 60 % on delivery, civil
    contract with no employment relationship (clause five, not in the extracted data).
  - Résumé: "What is the candidate's expected salary?" → said it is not in the document.
  - Receipt image: "What did I buy and how much did I pay?" → `get_document_details` only; items
    and the 43.000 COP total.
- Covered by unit/e2e tests only: tool argument validation errors returned to the model, the
  iteration limit with a tool-free last turn, abort on client disconnect, `error` event on a
  mid-stream failure, `404`/`409`/`400`.
- Implementation notes:
  - Abort uses the response `close` event (`!writableEnded`), not the request `close` event, which
    in current Node versions fires as soon as the body is read.
  - The SSE response is written with `res.writeHead`/`res.write`; exceptions before the first
    write still go through the global exception filter.
  - Documents processed before this spec have `summary: null` until they are uploaded again.

## Follow-up (not in this spec)

- Web client: read the SSE stream with `fetch` and show the summary and extracted data.
- Spec 006: the question endpoints need Lambda response streaming (function URL), since API
  Gateway REST APIs buffer responses and cut them at 29 seconds.
