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
- [ ] **T11** Manual run with the real API and the sample documents.

## Verification log

- 2026-10-26 — lint clean; 249 unit tests and 37 e2e tests pass; build OK.
- Probe before implementing: LangGraph 1.5.2 runs under ESM; nodes receive `context`, `writer`
  and `signal` in their runtime; `streamMode: ['custom', 'values']` yields `[mode, chunk]` pairs;
  an aborted signal ends the stream with `AbortError`.
- `QuestionAgentService` is tested with the real compiled graph and real nodes (only the LLM,
  structured output and tools are fakes): conversational path, tools + verification, history
  order, one revision, tool-free last turn, abort.
- Implementation notes:
  - `npm audit` reports advisories in `multer` (via NestJS) and `undici` (via `openai`); they were
    there before this spec and do not come from LangGraph.
  - The verified answer is sent as a single `delta` event after verification.

## Follow-up (not in this spec)

- `docuia-web`: send `conversationId`, show `status` events, list past conversations of a document.
- Spec 005b: expose the tools as an MCP server.
- Spec 006: DynamoDB `ConversationRepository` (one item per message).
