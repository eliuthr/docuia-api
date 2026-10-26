# 005 — LangGraph agent and conversation history: tasks

- [x] **T1** Add `@langchain/langgraph` and `@langchain/core`; check that ESM build and Vitest
      load them.
- [x] **T2** `StructuredRequest.logContext` replaces `documentId`; update extraction services and
      tests.
- [x] **T3** Conversations domain, `ConversationRepository`, Mongo implementation (two
      collections), in-memory fake for e2e + tests. (NFR-7)
- [x] **T4** `ConversationsService`, controller, DTOs, Swagger, `ConversationsModule` + tests.
      (US-4, AC-3.4–AC-3.6)
- [x] **T5** Schemas and prompts: classification, verdict, revision, conversational reply +
      schema tests. (NFR-2)
- [x] **T6** `question-category.ts` (with the `ToolName` enum), `agent-state.ts`,
      `agent-routes.ts` + route tests. (AC-1.2, AC-2.2, AC-2.3)
- [x] **T7** Nodes + tests: classify, callModel, runTools, verify, revise, respond, emitAnswer.
      (US-1, US-2)
- [x] **T8** `question-graph.factory.ts`, `QuestionAgentService` (custom stream → `AnswerEvent`,
      abort, recursion limit, logs) + tests; remove `ToolLoopService`. (NFR-4, NFR-5)
- [x] **T9** `QuestionAnsweringService`, `ConversationAnswerService`, DTO, controller:
      conversation checks, history, `conversation` and `status` events, store the exchange on
      `done` + tests. (US-3, US-5)
- [x] **T10** e2e with the scripted fake LLM (classification, tools, verification) and the
      in-memory conversation repository; README; lint, tests, e2e, build.
- [x] **T11** Manual run with the real API and the sample documents.

## Verification log

- 2026-10-26 — lint clean; 249 unit tests and 37 e2e tests pass; build OK.
- Probe before implementing: LangGraph 1.5.2 runs under ESM; nodes receive `context`, `writer`
  and `signal` in their runtime; `streamMode: ['custom', 'values']` yields `[mode, chunk]` pairs;
  an aborted signal ends the stream with `AbortError`.
- `QuestionAgentService` is tested with the real compiled graph and real nodes (only the LLM,
  structured output and tools are fakes): conversational path, tools + verification, history
  order, one revision, tool-free last turn, abort.
- Manual run against the real OpenAI API (`gpt-6-luna`), Docker MongoDB + Redis, with the
  documents already processed in earlier phases:
  - `POST /ask` "How much do all my invoices add up to, by currency?" → `classifying`,
    `answering`, `find_documents → sum_invoice_totals`, `verifying`, one `delta`, `done`;
    8.067.375 COP, 150 USD and 43.000 with no currency, matching the hand-calculated totals
    (the duplicated sample uploads are counted, and the answer says so).
  - Follow-up in the same conversation, "And how much of that is from Tecnosuministros?" →
    7.916.475 COP (three copies of the same invoice); only answerable with the history.
  - "Thanks!" in the same conversation → conversational path: no tools, no verification,
    streamed in four `delta` events.
  - Contract: "How is it paid, and is there an employment relationship?" →
    `get_document_details → search_document_text`; 40 % on signing, 60 % on delivery, civil
    contract with no employment relationship.
  - Résumé: "What is the candidate's expected salary?" → said it is not in the document.
  - `GET /conversations`, `GET /conversations?documentId=` and `GET /conversations/:id` list the
    conversations with the right scope and messages, oldest first.
  - Accented questions sent with `curl -d` from Git Bash on Windows were stored with `�`: the
    shell sent them in a non-UTF-8 encoding. The same question sent as a UTF-8 file was stored
    correctly, so the API is not affected.
- Covered by unit/e2e tests only: a revision after an `unsupported` verdict, the classification
  and verification fallbacks, the tool-free last turn, abort on client disconnect, `404`/`400`/
  `409` for conversations.
- Implementation notes:
  - `npm audit` reports advisories in `multer` (via NestJS) and `undici` (via `openai`); they were
    there before this spec and do not come from LangGraph.
  - The verified answer is sent as a single `delta` event after verification.

## Follow-up (not in this spec)

- `docuia-web`: send `conversationId`, show `status` events, list past conversations of a document.
- Spec 005b: expose the tools as an MCP server.
- Spec 006: DynamoDB `ConversationRepository` (one item per message).
