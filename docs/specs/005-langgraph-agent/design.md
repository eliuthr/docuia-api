# 005 — LangGraph agent and conversation history: design

## Flow

```
client ── POST /documents/:id/ask { question, conversationId? } ──► QuestionsController
                                       │ validate DTO; 404 / 409 document checks;
                                       │ 404 / 400 / 409 conversation checks (before streaming)
                                       ▼
                         QuestionAnsweringService  (document checks, open conversation, prompt)
                                       ▼
                         ConversationAnswerService → AsyncIterable<AnswerEvent>
                                       │ yield conversation { id }
                                       │ load last MAX_HISTORY_MESSAGES messages
                                       ▼
                     QuestionAgentService.run(...)  (compiled LangGraph StateGraph)

   START ─► classify ──conversational──► respond ─────────────────────────────► END
               │                         (one turn, no tools, deltas streamed live)
               └─other──► callModel ◄──────────────┐
                            │  tool calls? ─yes─► runTools
                            │  no
                            ▼
                         verify ──supported, or limit reached──► emitAnswer ─► END
                            │
                            └─unsupported (revisions < 1, turns left)──► revise ─► callModel

                                       ▼
                         ConversationsService.appendExchange(question, answer)  (AC-3.3)
                                       │ yield done
```

Concepts used:

- **StateGraph**: LangGraph's graph where every node receives a shared state object and returns a
  partial update; edges (fixed or conditional) decide which node runs next.
- **Conditional edge**: a function that reads the state and returns the name of the next node.
  Routing lives in these functions, not inside the nodes.
- **Custom stream mode**: nodes call `runtime.writer(event)`, and `graph.stream()` with
  `streamMode: ['custom', 'values']` yields those events plus the state after each step; this is
  how `tool`, `status` and `delta` reach SSE and how the final answer is read.
- **Context**: per-run data that is not state (`logContext`, `instructions`, `signal`), declared
  with a context schema and passed as `graph.stream(input, { context })`.

## Module map

```
src/ai/
├── agent/
│   ├── agent-state.ts               AgentState (state channels) + AgentContextSchema
│   ├── question-category.ts         categories + CATEGORY_TOOLS map
│   ├── agent-routes.ts              AgentNode names + conditional edge functions (pure)
│   ├── model-turn.ts                collectTurn: consumes one streamed model turn
│   ├── emit-event.ts                writes an AnswerEvent to the custom stream
│   ├── question-graph.factory.ts    buildQuestionGraph (nodes + edges) + QuestionGraphFactory
│   ├── question-agent.service.ts    runs the graph, forwards events, returns the final answer
│   └── nodes/
│       ├── classify-question.node.ts   StructuredOutputService + questionClassificationSchema
│       ├── call-model.node.ts          one llm.streamTurn with the category tools; buffers the draft
│       ├── run-tools.node.ts           ToolRegistry.execute per call; collects evidence
│       ├── verify-answer.node.ts       StructuredOutputService + answerVerdictSchema
│       ├── revise-answer.node.ts       appends reviewer feedback as a user message
│       ├── respond.node.ts             conversational path: tools = [], deltas streamed live
│       └── emit-answer.node.ts         sends the accepted draft as one delta event
├── tools/
│   ├── tool-name.ts                 ToolName enum, shared by the tools and CATEGORY_TOOLS
│   └── tool-registry.ts             definitions(names?) filters by tool name
├── schemas/
│   ├── question-classification.schema.ts  { category }
│   └── answer-verdict.schema.ts            { verdict: 'supported' | 'unsupported', feedback }
├── prompts/
│   ├── classify-question.prompt.ts
│   ├── verify-answer.prompt.ts
│   ├── revise-answer.prompt.ts
│   └── answer-conversational.prompt.ts   no tools, so the answer rules do not apply
└── questions/
    ├── answer-event.ts              + conversation, status
    ├── question-answering.service.ts   document checks, opens the conversation, picks the prompt
    ├── conversation-answer.service.ts  history → agent → store the exchange → done
    ├── dto/ask-question.dto.ts      + conversationId (optional UUID v4)
    └── tool-loop.service.ts         removed (replaced by the graph)

src/conversations/
├── domain/conversation-scope.ts        ConversationScope + helpers (null documentId = collection)
├── domain/conversation.entity.ts       ConversationEntity, ConversationMessage, CONVERSATION_ROLES
├── repositories/conversation.repository.ts       abstract class (port)
├── repositories/mongo-conversation.repository.ts
├── repositories/conversation-persistence.module.ts
├── schemas/conversation-record.schema.ts         conversations collection
├── schemas/conversation-message-record.schema.ts conversation_messages collection
├── conversations.service.ts            openForQuestion, recentMessages, appendExchange, list,
│                                       findWithMessages
├── conversations.controller.ts         GET /conversations, GET /conversations/:id
├── dto/…                               list query, summary and detail responses
└── conversations.module.ts             exports ConversationsService
```

Dependencies: `QuestionsModule` → `LlmModule`, `ToolsModule`, `DocumentPersistenceModule`,
`ConversationsModule` → `ConversationPersistenceModule`. Nothing under
`src/conversations` imports `src/ai` (NFR-6). The worker loads neither module.

## Agent state

```ts
const AgentState = Annotation.Root({
  question: lastValue<string>,
  items: appended<ConversationItem>,      // history + question + model turns + tool results
  category: lastValue<QuestionCategory | null>,
  pendingToolCalls: lastValue<ToolCallItem[]>, // set by callModel, consumed by runTools
  draft: lastValue<string>,               // text of the latest model turn
  evidence: appended<string>,             // "tool_name: result" per tool call
  turns: lastValue<number>,               // answer turns used (callModel + respond)
  revisions: lastValue<number>,
  verdict: lastValue<AnswerVerdict | null>,
});

const AgentContextSchema = Annotation.Root({ logContext, instructions, signal });
```

`items` starts with the history messages and the new question. Request data that does not change
goes in the LangGraph `context`, not in the state.

## Classification and tool selection

| Category         | Example                                      | Tools                                                     |
| ---------------- | -------------------------------------------- | --------------------------------------------------------- |
| `lookup`         | "Who is the vendor?", "Which contracts?"     | all four                                                  |
| `text_search`    | "What does clause five say?"                 | `search_document_text`, `get_document_details`            |
| `calculation`    | "How much do these invoices add up to?"      | `find_documents`, `sum_invoice_totals`, `get_document_details` |
| `conversational` | "Thanks!", "Answer in English from now on"   | none (no verification)                                    |

The classifier gets the last history messages so follow-ups are classified with context. Its
output is validated with `questionClassificationSchema` through `StructuredOutputService` (one
retry). On `InvalidLlmResponseError` it falls back to `lookup` (AC-1.4), since that category has
every tool and is always safe.

## Verification

The verifier receives the question, the draft and the evidence (tool results, joined and cut to
`MAX_VERIFICATION_EVIDENCE_CHARS`). It answers `{ verdict, feedback }`. It checks that numbers,
names and dates in the draft appear in the evidence and that the draft does not claim things the
evidence does not support. It does not judge style.

- `unsupported` with revisions and turns left → `revise` appends a user message built from
  `revise-answer.prompt.ts` with the feedback, then `callModel` runs again with the same tools.
- Otherwise → `emitAnswer`. If the verifier output is invalid twice, the draft is sent and
  `answer.verification.skipped` is logged (AC-2.4).

Because verification needs the whole draft, `callModel` buffers the text and `emitAnswer` sends it
after the verdict (AC-5.4). The client sees `status` and `tool` events in the meantime.

## Iteration and cost limits

- `turns` counts every answer turn; `callModel` runs with `tools = []` when
  `turns + 1 === AGENT_MAX_ITERATIONS`, as in spec 004.
- LLM calls per question, worst case: classification 2 + answer turns 5 + verification 2 = 9.
  Typical: 1 + 2 + 1 = 4 small calls with the cheap model.
- `recursionLimit` on the compiled graph is set from `AGENT_MAX_ITERATIONS` as a second guard
  against a routing bug.
- The `AbortSignal` is passed both to `graph.stream` and to every LLM call (AC-4.2 of spec 004).

## SSE protocol (additions)

```
event: conversation
data: {"id":"5b0c…"}

event: status
data: {"step":"classifying"}

event: tool
data: {"name":"find_documents"}

event: status
data: {"step":"verifying"}

event: delta
data: {"text":"Las facturas de …"}

event: done
data: {}
```

The web client must ignore unknown events; it already reads `tool`, `delta`, `done`, `error`.

## Conversation storage

```ts
type ConversationScope = { kind: 'document'; documentId: string } | { kind: 'collection' };

interface ConversationEntity {
  id: string;
  scope: ConversationScope;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  createdAt: Date;
}

abstract class ConversationRepository {
  abstract create(conversation: NewConversation): Promise<ConversationEntity>; // id from the service
  abstract findById(id: string): Promise<ConversationEntity | null>;
  abstract listByScope(scope: ConversationScope, limit: number): Promise<ConversationEntity[]>;
  abstract findRecentMessages(id: string, limit: number): Promise<ConversationMessage[]>;
  abstract findAllMessages(id: string): Promise<ConversationMessage[]>;
  abstract appendMessages(id: string, messages: ConversationMessage[]): Promise<void>;
}
```

Mongo uses two collections: `conversations` (one document per conversation, index on
`scope.documentId` + `updatedAt`) and `conversation_messages` (one document per message, index on
`conversationId` + `createdAt`). This is the shape DynamoDB will use in spec 006 (one item per
message under the conversation's partition key), so no conversation grows into a single large
item (NFR-7). `appendMessages` also increments `messageCount` and sets `updatedAt`.

The conversation is created before streaming starts, so its id can be the first event. A
conversation whose first answer fails stays with zero messages; list endpoints hide conversations
with `messageCount === 0`.

## API (additions)

| Method | Path                         | Response                                                       |
| ------ | ---------------------------- | -------------------------------------------------------------- |
| `POST` | `/documents/:id/ask`         | body gains `conversationId?` (UUID v4)                         |
| `POST` | `/ask`                       | body gains `conversationId?` (UUID v4)                         |
| `GET`  | `/conversations?documentId=` | `ConversationSummaryDto[]` (id, title, messageCount, dates)    |
| `GET`  | `/conversations/:id`         | `ConversationDetailDto` (summary fields, scope and `messages`) |

## Constants

`MAX_HISTORY_MESSAGES = 10`, `MAX_CONVERSATION_MESSAGES = 100`, `CONVERSATION_LIST_LIMIT = 20`,
`CONVERSATION_TITLE_LENGTH = 80`, `MAX_ANSWER_REVISIONS = 1`,
`MAX_VERIFICATION_EVIDENCE_CHARS = 12000`, `CLASSIFY_MAX_OUTPUT_TOKENS = 200`,
`VERIFY_MAX_OUTPUT_TOKENS = 400`, `ANSWER_MAX_OUTPUT_TOKENS = 2000` (moved from the tool loop). No new environment variables; `AGENT_MAX_ITERATIONS` is reused.

## Other changes

- `StructuredRequest.documentId` becomes `logContext: Record<string, string>`, like
  `TurnRequest`, because classification and verification also run for collection questions that
  have no document. The extraction services pass `{ documentId }`.

## Dependencies

- `@langchain/langgraph` 1.5.2 — the graph runtime (state, nodes, edges, streaming).
- `@langchain/core` 1.3.0 — required peer dependency of LangGraph; not imported directly, and no
  LangChain model classes are used (NFR-1).

## Testing strategy

- Unit: `agent-routes` (every branch), each node with mocked `LlmProvider`, `StructuredOutputService`
  and `ToolRegistry` (classification fallback, tool subset, buffered draft, evidence cut, revision
  message), `QuestionAgentService` with a scripted fake LLM (conversational path, tool path,
  `unsupported` → revision → accepted, iteration limit, abort), `ConversationsService` (create,
  scope mismatch, full conversation, title cut), `QuestionAnsweringService` (history loaded,
  exchange stored only on `done`), schemas.
- e2e: in-memory `ConversationRepository`; first question creates a conversation and the second
  sends history; `GET /conversations` and `GET /conversations/:id`; `404`/`400`/`409`; SSE event
  order including `conversation` and `status`.
- Manual: real API with the sample documents; a follow-up question that only makes sense with
  history; a calculation; a greeting; a question where the first draft is likely wrong (to see a
  revision in the logs).

## Decisions

- **LangGraph for orchestration, our own `LlmProvider` inside the nodes**: the graph makes the
  steps visible and testable, while the provider abstraction from specs 003–004 still decides
  between Ollama, OpenAI and Anthropic. LangChain chat models would duplicate that layer.
- **Own `ConversationRepository` instead of a LangGraph checkpointer**: it follows the same port as
  `DocumentRepository`, there is no official DynamoDB checkpointer, and clients need a readable
  history (questions and answers), not the graph's internal state.
- **History stores only questions and final answers**: tool results can be large and are cheap to
  recompute; the model calls tools again when a follow-up needs data.
- **Buffered answer when it is verified**: sending an answer that may then be corrected would be
  confusing. The cost is a later first `delta`; `status` events keep the client informed.
- **Classification picks a tool subset, not a fixed path**: fewer tools mean shorter requests and
  fewer wrong calls, while the model still decides the order of calls.
- **Fallbacks instead of failing the question**: an invalid classification or verdict does not
  stop the user from getting an answer; both are validated with Zod and logged when they fail.
