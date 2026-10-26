# 005 — LangGraph agent and conversation history: requirements

> Phase 5 (week 5) of the DocuIA roadmap.
> Deliverable: a multi-step agent that classifies the question, picks tools, checks its own answer
> against the tool results, and remembers the conversation — and that can be explained in an
> interview.

## Context

Spec 004 answers questions with a hand-written tool loop: the model calls tools until it answers,
and the answer is streamed as it is written. Nothing checks that the answer matches the tool
results, every question is sent with every tool, and each question starts from zero.

This spec replaces the loop with a LangGraph.js graph with explicit steps (classify → answer with
tools → verify → revise once if needed) and stores each conversation so follow-up questions
("and the other invoice?") work, both for one document and for the whole collection.

## Scope

In scope:

- A LangGraph.js `StateGraph` that replaces `ToolLoopService`.
- Question classification with a Zod-validated output, and a tool subset per category.
- Answer verification against the tool results, with at most one revision.
- Conversations stored through a `ConversationRepository` (MongoDB now; DynamoDB in spec 006).
- `conversationId` in both ask endpoints, and endpoints to list and read conversations.
- New SSE events: `conversation` and `status`.

Out of scope: the MCP server (spec 005b), LangGraph checkpointers, storing tool calls in the
history, deleting or renaming conversations, authentication and per-user conversations (spec 007),
UI changes (separate repo, `docuia-web`).

## User stories and acceptance criteria

### US-1 — The agent classifies the question and picks tools

- **AC-1.1** WHEN a question arrives, THE SYSTEM SHALL classify it into one category:
  `lookup`, `text_search`, `calculation` or `conversational`, using the question and the recent
  history.
- **AC-1.2** THE SYSTEM SHALL offer the model only the tools mapped to that category.
- **AC-1.3** WHEN the category is `conversational`, THE SYSTEM SHALL answer without tools and
  without verification.
- **AC-1.4** WHEN the classification fails Zod validation twice, THE SYSTEM SHALL fall back to the
  `lookup` category with all tools and log the fallback.

### US-2 — The agent verifies its answer

- **AC-2.1** WHEN the agent used tools, THE SYSTEM SHALL check the draft answer against the tool
  results before sending it, with a Zod-validated verdict (`supported` | `unsupported` and
  feedback).
- **AC-2.2** WHEN the verdict is `unsupported`, THE SYSTEM SHALL ask the model to revise the
  answer with the feedback, at most `MAX_ANSWER_REVISIONS` (1) times.
- **AC-2.3** WHEN the revision limit or `AGENT_MAX_ITERATIONS` is reached, THE SYSTEM SHALL send
  the latest draft.
- **AC-2.4** WHEN the verdict fails Zod validation twice, THE SYSTEM SHALL send the draft and log
  that verification was skipped.

### US-3 — Conversations are remembered

- **AC-3.1** WHEN a client asks without `conversationId`, THE SYSTEM SHALL create a conversation
  bound to the document (`POST /documents/:id/ask`) or to the collection (`POST /ask`).
- **AC-3.2** WHEN a client asks with `conversationId`, THE SYSTEM SHALL send the last
  `MAX_HISTORY_MESSAGES` messages of that conversation to the model as context.
- **AC-3.3** WHEN the answer completes, THE SYSTEM SHALL store the question and the final answer
  as two messages; WHEN the answer fails or the client disconnects, it SHALL store nothing.
- **AC-3.4** WHEN `conversationId` does not exist, THE SYSTEM SHALL respond `404` before streaming.
- **AC-3.5** WHEN the conversation belongs to another document or to the other scope, THE SYSTEM
  SHALL respond `400` before streaming.
- **AC-3.6** WHEN the conversation already has `MAX_CONVERSATION_MESSAGES` messages, THE SYSTEM
  SHALL respond `409` and ask the client to start a new conversation.

### US-4 — Clients can read conversations

- **AC-4.1** `GET /conversations?documentId=<uuid>` SHALL return the most recent conversations of
  that document (at most `CONVERSATION_LIST_LIMIT`), newest first, with id, title, message count
  and dates; without `documentId` it SHALL return collection conversations.
- **AC-4.2** `GET /conversations/:id` SHALL return the conversation with all its messages, oldest
  first; `404` when it does not exist.
- **AC-4.3** A conversation's title SHALL be its first question, cut to `CONVERSATION_TITLE_LENGTH`
  characters.

### US-5 — The client sees the agent's progress

- **AC-5.1** THE SYSTEM SHALL send `conversation` ({ id }) as the first SSE event.
- **AC-5.2** THE SYSTEM SHALL send `status` ({ step }) when a step starts, with `step` one of
  `classifying`, `answering`, `verifying`, `revising`.
- **AC-5.3** THE SYSTEM SHALL keep the spec 004 events: `tool`, `delta`, `done`, `error`.
- **AC-5.4** WHEN the answer will be verified, THE SYSTEM SHALL send its `delta` events only after
  the verification; for `conversational` questions it SHALL stream them as they are written.

## Non-functional requirements

- **NFR-1** Graph nodes depend on `LlmProvider` and `ToolRegistry`, never on LangChain model
  classes or a provider SDK.
- **NFR-2** Classification, verification and revision prompts live in `src/ai/prompts/`.
- **NFR-3** No test calls a paid API; e2e tests use a scripted fake `LlmProvider` that also answers
  the structured classification and verification requests.
- **NFR-4** Cost control: at most `AGENT_MAX_ITERATIONS` answer turns per question (revisions
  included), bounded evidence size for the verifier, bounded output tokens per call, bounded
  history sent to the model.
- **NFR-5** Logs include the endpoint, `documentId` and `conversationId` when present, the
  category, the tools called, the number of turns, the verdict and whether a revision happened;
  never the question, the answer or document content.
- **NFR-6** `ConversationsModule` does not import any `ai` module; no circular dependencies.
- **NFR-7** The conversation storage model must fit DynamoDB's 400 KB item limit in spec 006
  (messages are not stored as one unbounded array).
