# 003 — LLM extraction: design

## Flow

```
Worker: DocumentProcessingService.process(documentId)
  1–3. same as spec 002 (missing / finished / set processing)
  4.   input = text extraction (PDF) or image bytes (PNG, JPEG)
         PDF with empty text → ready, documentType null              (AC-1.3)
  5.   analysis = DocumentAnalyzerService.analyze(documentId, input)
         ├─ DocumentClassifierService    → invoice | contract | resume | other (AC-1.1)
         └─ DocumentDataExtractorService (skipped for other)          (AC-1.2, AC-2.1)
  6.   update ready, pageCount, textStorageKey, documentType, extractedData
```

Each LLM call goes through `StructuredOutputService`, which validates with Zod and retries once:

```
StructuredOutputService.generate(request)
  raw = llm.generateJson(request)     transient API error → propagates → BullMQ retry (AC-3.4)
  schema.safeParse(JSON.parse(raw))  ok → return
                                     fail (bad JSON or schema) → second call
                                       → fail → InvalidLlmResponseError     (AC-3.2, AC-3.3)
```

## Module map

```
src/ai/
├── llm/
│   ├── llm.provider.ts            abstract LlmProvider + LlmInput, StructuredRequest
│   ├── openai-llm.provider.ts     OpenAI SDK (Responses API, structured output, vision)
│   ├── truncate-input.ts          cuts text input to a character limit
│   └── llm.module.ts              OpenAI client + provideByDriver(LlmProvider, 'LLM_DRIVER', …)
├── prompts/
│   ├── extraction-rules.prompt.ts shared rules (nulls, dates, amounts, prompt injection)
│   ├── classify-document.prompt.ts
│   ├── extract-invoice.prompt.ts
│   ├── extract-contract.prompt.ts
│   └── extract-resume.prompt.ts
├── schemas/
│   ├── document-type.ts           enum + classification schema
│   ├── schema-fields.ts           shared nullable fields (text, amount, date, currency)
│   ├── extracted-data.ts          union of the three data types
│   ├── invoice.schema.ts
│   ├── contract.schema.ts
│   └── resume.schema.ts
├── extraction/
│   ├── structured-output.service.ts   validation + one retry
│   ├── document-classifier.service.ts      DocumentClassifierService
│   ├── document-data-extractor.service.ts  DocumentDataExtractorService: type → { schema, prompt }
│   └── document-analyzer.service.ts        DocumentAnalyzerService: classify → extract
├── errors/                        InvalidLlmResponseError, LlmQuotaExceededError
└── ai.module.ts                   exports DocumentAnalyzerService
```

`ProcessingModule` imports `AiModule`. `ai` does not import `documents` or `processing`; the
`DocumentType` enum lives in `ai/schemas` and the document entity references it.

## Abstractions

```ts
type LlmInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; mimeType: string; content: Buffer };

interface StructuredRequest {
  documentId: string; // for logs only
  instructions: string; // system prompt from src/ai/prompts
  input: LlmInput;
  schemaName: string; // e.g. 'invoice'
  jsonSchema: JsonSchema; // z.toJSONSchema(schema) without `$schema`
  maxOutputTokens: number;
}

abstract class LlmProvider {
  /** Returns the raw text produced by the model (expected JSON); it is NOT trusted. */
  abstract generateJson(request: StructuredRequest): Promise<string>;
}
```

The provider receives a JSON Schema, not a Zod schema, and returns raw text, so implementations
don't depend on Zod and both JSON parsing and validation stay in one place
(`StructuredOutputService`). A truncated or refused response simply fails validation.

`OpenAiLlmProvider` uses structured output in strict mode (the API constrains the response to the
schema), sends images as base64 data URLs, sets `max_output_tokens` and a timeout, sends
`store: false` (responses are not kept by OpenAI) and disables the SDK's own retries so BullMQ owns
retrying. It logs model and token usage. The `OpenAI` client is a Nest provider, so tests inject a
fake.

## Schemas

All fields are required and nullable (`T | null`): strict structured output requires every key,
and `null` means "not in the document" (AC-2.2). Dates are ISO strings `YYYY-MM-DD`; amounts are
numbers; currencies are ISO 4217 codes. Résumé dates use `YYYY-MM`, since CVs rarely include the
day, and `endDate` is `null` for the current job.

| Type       | Fields                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoice`  | `vendorName`, `vendorTaxId`, `customerName`, `invoiceNumber`, `issueDate`, `dueDate`, `currency`, `subtotal`, `tax`, `total`, `lineItems[]` (`description`, `quantity`, `unitPrice`, `amount`) |
| `contract` | `title`, `parties[]` (`name`, `role`), `effectiveDate`, `expirationDate`, `value`, `currency`, `governingLaw`, `summary`                                                                       |
| `resume`   | `fullName`, `email`, `phone`, `location`, `summary`, `skills[]`, `experience[]` (`company`, `role`, `startDate`, `endDate`), `education[]` (`institution`, `degree`, `endYear`)                |

Classification schema: `{ documentType: 'invoice' | 'contract' | 'resume' | 'other' }`.

## Configuration (new variables)

| Variable              | Type             | Default      |
| --------------------- | ---------------- | ------------ |
| `LLM_DRIVER`          | `openai`         | `openai`     |
| `OPENAI_API_KEY`      | string, required | —            |
| `OPENAI_MODEL`        | string           | `gpt-6-luna` |
| `LLM_TIMEOUT_MS`      | int ≥ 1000       | `60000`      |
| `LLM_MAX_INPUT_CHARS` | int ≥ 1000       | `50000`      |

The output token limit is a named constant per request type, not configuration: 1,000 for
classification (whose input is also cut to the first 4,000 characters) and 8,000 for extraction.
The limits are generous because reasoning tokens count toward them; they cap the worst case, not
the usual cost.

## Errors

- `InvalidLlmResponseError` (ai): thrown after the retry fails validation.
- `DocumentProcessingService` translates it into `DataExtractionFailedError`, a permanent
  processing error whose `cause` keeps the original error for logs.
  `UnreadableDocumentError` and the new error extend `PermanentProcessingError`; the BullMQ consumer
  and `failureReasonFor` check the base class, so permanent errors stay in one place.
- User-safe reason: "The document data could not be extracted. Try again later."
- `LlmQuotaExceededError` (ai): `OpenAiLlmProvider` maps a `429` with code `insufficient_quota`
  (spend limit or credit balance exhausted) to it. Retrying cannot succeed until the limit resets,
  so it is also translated into a permanent processing error (AC-3.5). A `429` with
  `rate_limit_exceeded` stays transient.
- Other OpenAI SDK errors propagate unchanged (transient, retried by BullMQ); the stored reason
  stays the generic one from spec 002.

## Domain and API changes

`DocumentEntity` gains `documentType: DocumentType | null` and
`extractedData: ExtractedData | null` (union of the three schema types). Both are stored in the
record: extracted data is small (well under DynamoDB's 400 KB item limit), unlike the full text.
The Mongo schema uses `Mixed` for `extractedData`.

`DocumentResponseDto` adds both fields. Swagger describes `extractedData` as a free-form object
with an invoice example: the Zod-generated JSON Schemas use JSON Schema 2020-12 features
(`type: [..., "null"]`) that the OpenAPI 3.0 document does not support.

## Testing strategy

- Unit: schemas (valid, nulls, invalid), `StructuredOutputService` (ok, retry ok, retry fails,
  transient error not retried), classifier, data extractor (per type), analyzer (`other` skips
  extraction), `OpenAiLlmProvider` with a mocked client (request shape, image input, JSON parse),
  `DocumentProcessingService` new branches, consumer handling of the new permanent error, env.
- e2e: `LlmProvider` is not loaded by the API; existing e2e checks the new fields (`null` while
  pending).
- Manual: real OpenAI key; upload a sample invoice PDF, a contract, a résumé and a photo of a
  receipt; check `documentType`, `extractedData` and the token usage in logs.

## Decisions

- **Two calls (classify, then extract)** instead of one call with a union schema: each prompt is
  small and focused, classification only needs the start of the document, and the steps map
  directly to the agent nodes of spec 005. Cost stays below a tenth of a cent per document.
- **OpenAI first, behind `LlmProvider`**: the cheapest suitable model for the demo; Ollama and
  Anthropic are additions, not rewrites.
- **Validation outside the provider**: strict structured output already constrains the shape, but
  Zod is still the source of truth (formats, enums) and works the same for any future provider.
- **Scanned PDFs are not sent to the model**: it would require rendering pages to images; left for
  a later spec.
