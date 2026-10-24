# 003 — LLM extraction: tasks

- [x] **T1** `openai` dependency; new env variables + validation tests; `.env.example`.
- [x] **T2** Schemas (`document-type`, invoice, contract, résumé) + tests. (AC-2.2)
- [x] **T3** `LlmProvider`, `OpenAiLlmProvider` (incl. `LlmQuotaExceededError`), `LlmModule` +
      tests. (AC-2.3, AC-2.4, AC-3.5, NFR-1, NFR-4, NFR-5)
- [x] **T4** Prompts in `src/ai/prompts/`. (NFR-2)
- [x] **T5** `StructuredOutputService` + `InvalidLlmResponseError` + tests. (AC-3.1–3.2)
- [x] **T6** Classifier, data extractor, analyzer, `AiModule` + tests. (AC-1.1, AC-1.2, AC-2.1)
- [x] **T7** Domain: `documentType`, `extractedData` in entity, schema, repositories, response DTO.
      (AC-4.1, AC-4.2)
- [x] **T8** `PermanentProcessingError`; processing service calls the analyzer; consumer update +
      tests. (AC-1.3, AC-3.3–3.5, NFR-6)
- [x] **T9** e2e updates; README; lint, tests, e2e, build.
- [x] **T10** Manual run with a real API key and sample documents.

## Verification log

- 2026-10-23 — lint clean; 97 unit tests and 15 e2e tests pass; build OK.
- Manual run against the real OpenAI API (`gpt-6-luna`), Docker MongoDB + Redis, API and worker
  as separate processes:
  - Text PDF invoice (test fixture) → `invoice`; vendor, number, currency and total extracted;
    missing fields `null`.
  - Spanish lease contract PDF → `contract`; both parties with roles, dates converted to ISO
    (`2026-02-01` – `2027-01-31`), value `1500000 COP`, governing law.
  - Spanish résumé PDF → `resume`; dates as `YYYY-MM`, current job with `endDate: null`.
  - PNG photo of a supermarket receipt (vision) → `invoice`; NIT, POS number, date, three line
    items, subtotal, tax and total read correctly.
  - Meeting minutes PDF → `other`, `extractedData: null` (no extraction call).
  - Image-only (scanned) PDF → `ready` with `documentType: null`; the LLM is not called.
- Covered by unit tests only (not reproduced manually): invalid output retried once then `failed`
  (AC-3.2, AC-3.3), exhausted quota failing without retries (AC-3.5).
- Implementation notes:
  - `openai` is pinned to `7.37.0`; newer releases were days old.
  - `npm audit` reports `undici` advisories through `@nestjs/mau` and `openai`; the only automatic
    fix downgrades NestJS, so it is left for a dependency update.
  - `LlmProvider.generateJson` returns raw text instead of parsed JSON, so malformed JSON goes
    through the same retry path as schema errors.

## Follow-up (not in this spec)

- Scanned PDFs: render pages to images and send them through the vision path.
- Ollama and Anthropic implementations of `LlmProvider`.
