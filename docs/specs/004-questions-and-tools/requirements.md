# 004 — Questions and tool calling: requirements

> Phase 4 (week 4) of the DocuIA roadmap.
> Deliverable: a user asks "how much do this vendor's invoices add up to?" and the model answers
> by calling DocuIA's tools, streaming the answer as it is written.

## Context

Spec 003 classifies documents and stores their structured data. This spec lets clients ask
questions in natural language, about one document or about the whole collection. The model does
not guess: it calls tools (search a document's text, look up documents, add up invoice totals) and
answers from their results. It also adds a short summary to every processed document.

## Scope

In scope:

- `POST /documents/:id/ask` (one document) and `POST /ask` (the whole collection).
- A tool-calling loop with an iteration limit.
- Four tools: get document details, search a document's text, find documents, sum invoice totals.
- Streaming answers with Server-Sent Events (SSE).
- A `summary` for every document, generated during processing.

Out of scope: conversation history and the LangGraph agent (spec 005), semantic search with
embeddings, authentication and per-user data (spec 007), a web UI for questions (separate repo).

## User stories and acceptance criteria

### US-1 — Ask about one document

- **AC-1.1** WHEN a client sends `POST /documents/:id/ask` with a `question`, THE SYSTEM SHALL
  stream an answer about that document.
- **AC-1.2** WHEN the document does not exist, THE SYSTEM SHALL respond `404` before streaming.
- **AC-1.3** WHEN the document is not `ready`, THE SYSTEM SHALL respond `409` before streaming.
- **AC-1.4** WHEN the id is not a UUID or the question is empty or longer than
  `MAX_QUESTION_LENGTH`, THE SYSTEM SHALL respond `400`.

### US-2 — Ask about the collection

- **AC-2.1** WHEN a client sends `POST /ask` with a `question`, THE SYSTEM SHALL stream an answer
  that may use any ready document.
- **AC-2.2** WHEN the question needs a calculation over several documents (for example, a sum of
  invoice totals), THE SYSTEM SHALL compute it with a tool, not with the model.

### US-3 — The model uses tools

- **AC-3.1** THE SYSTEM SHALL offer the model these tools, each with a Zod input schema:
  `get_document_details`, `search_document_text`, `find_documents`, `sum_invoice_totals`.
- **AC-3.2** WHEN the model calls a tool with arguments that fail validation, THE SYSTEM SHALL
  return the validation error to the model as the tool result instead of failing the request.
- **AC-3.3** WHEN a tool refers to a document that does not exist, THE SYSTEM SHALL return a
  "not found" tool result.
- **AC-3.4** THE SYSTEM SHALL stop calling the model after `AGENT_MAX_ITERATIONS` turns; the last
  allowed turn is made without tools so the model must answer.
- **AC-3.5** THE SYSTEM SHALL only use data from ready documents in tool results.

### US-4 — Answers are streamed

- **AC-4.1** THE SYSTEM SHALL respond with `Content-Type: text/event-stream` and send these
  events: `tool` (a tool is being used, with its name), `delta` (a piece of the answer text),
  `done` (the answer is complete) and `error` (the answer failed, with a user-safe message).
- **AC-4.2** WHEN the client disconnects, THE SYSTEM SHALL abort the model request so no more
  tokens are spent.
- **AC-4.3** WHEN the LLM fails after streaming started, THE SYSTEM SHALL send an `error` event and
  close the stream; it SHALL NOT expose provider details.

### US-5 — Documents have a summary

- **AC-5.1** WHEN a document is analyzed, THE SYSTEM SHALL store a `summary` of at most three
  sentences, for every type including `other`.
- **AC-5.2** THE SYSTEM SHALL include `summary` (string or `null`) in every document
  representation.

## Non-functional requirements

- **NFR-1** The tool loop depends on `LlmProvider`, not on the OpenAI SDK.
- **NFR-2** Tools live in `src/ai/tools/`, one file each, with their own tests; prompts in
  `src/ai/prompts/`.
- **NFR-3** No test calls a paid API; e2e tests use a scripted fake `LlmProvider`.
- **NFR-4** Cost control: `AGENT_MAX_ITERATIONS` (default 5), bounded tool output size, bounded
  output tokens per turn.
- **NFR-5** Logs include the endpoint, `documentId` when present, the tools called, the number of
  turns and token usage; never the question text or document content.
- **NFR-6** No circular dependencies between modules.
