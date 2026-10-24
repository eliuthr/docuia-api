# 003 — LLM extraction: requirements

> Phase 3 (week 3) of the DocuIA roadmap.
> Deliverable: a user uploads an invoice, a contract or a résumé and the API returns its data as
> validated JSON.

## Context

Spec 002 extracts the plain text of PDFs in a background worker. This spec adds an `ai` module
that sends that text (or the image itself, for PNG and JPEG) to an LLM, classifies the document
and extracts structured data with a schema per document type. Every model response is validated
with Zod before it is stored.

## Scope

In scope:

- `LlmProvider` abstraction with an OpenAI implementation (default model: GPT-6 Luna).
- Document classification: `invoice`, `contract`, `resume` or `other`.
- Structured extraction with one Zod schema per type (invoice, contract, résumé).
- Vision input for PNG and JPEG documents.
- Validation, one retry on invalid output, then `failed`.
- Expose `documentType` and `extractedData` in the document representation.

Out of scope: Ollama and Anthropic providers (the interface allows adding them later), questions
about documents and tool calling (spec 004), the agent (spec 005), OCR or rendering scanned PDFs
to images, streaming.

## User stories and acceptance criteria

### US-1 — Documents are classified

- **AC-1.1** WHEN a document has extracted text or is an image, THE SYSTEM SHALL ask the LLM to
  classify it as `invoice`, `contract`, `resume` or `other` and store the result as `documentType`.
- **AC-1.2** WHEN the document is classified as `other`, THE SYSTEM SHALL set it to `ready` with
  `extractedData` `null`.
- **AC-1.3** WHEN a PDF has no extractable text, THE SYSTEM SHALL skip the LLM and set it to
  `ready` with `documentType` and `extractedData` `null`.

### US-2 — Data is extracted per type

- **AC-2.1** WHEN the document is an invoice, contract or résumé, THE SYSTEM SHALL extract its data
  with the schema for that type and store it as `extractedData`.
- **AC-2.2** WHEN a field is not present in the document, THE SYSTEM SHALL store it as `null`
  instead of inventing a value.
- **AC-2.3** WHEN the document is an image, THE SYSTEM SHALL send the image to a vision-capable
  model for classification and extraction.
- **AC-2.4** WHEN the text is longer than `LLM_MAX_INPUT_CHARS`, THE SYSTEM SHALL send only the
  first `LLM_MAX_INPUT_CHARS` characters.

### US-3 — Model output is validated

- **AC-3.1** THE SYSTEM SHALL validate every LLM response with a Zod schema before using or
  storing it.
- **AC-3.2** WHEN a response fails validation, THE SYSTEM SHALL retry the same request once.
- **AC-3.3** WHEN the retry also fails validation, THE SYSTEM SHALL set the document to `failed`
  without further queue retries, with a user-safe `failureReason`.
- **AC-3.4** WHEN the LLM API fails with a transient error (timeout, rate limit, 5xx), THE SYSTEM
  SHALL let the queue retry the job as in spec 002.
- **AC-3.5** WHEN the LLM API rejects the request because the spend limit or credit balance is
  exhausted, THE SYSTEM SHALL set the document to `failed` without queue retries.

### US-4 — Clients see the result

- **AC-4.1** THE SYSTEM SHALL include `documentType` (enum or `null`) and `extractedData` (object
  or `null`) in every document representation.
- **AC-4.2** THE SYSTEM SHALL NOT expose prompts, raw model output or provider error details.

## Non-functional requirements

- **NFR-1** Processing depends on `LlmProvider`, never on the OpenAI SDK; the provider is chosen by
  `LLM_DRIVER`.
- **NFR-2** Prompts live in `src/ai/prompts/`; schemas in `src/ai/schemas/`.
- **NFR-3** No test calls a paid API: the LLM is mocked in unit and e2e tests.
- **NFR-4** Cost control: cheap model by default, input truncation, a bounded output token limit
  and at most two LLM calls per document (plus one retry each).
- **NFR-5** Logs include `documentId`, `documentType`, the model and token usage; never the API
  key or the document content.
- **NFR-6** No circular dependencies: `processing` → `ai`, never the other way.
