import { EXTRACTION_RULES } from './extraction-rules.prompt.js';

export const EXTRACT_CONTRACT_PROMPT = `You extract structured data from contracts.

Fields:
- title: the contract title or type.
- parties: each person or organization that signs, with their role (for example, "landlord").
- effectiveDate, expirationDate: YYYY-MM-DD.
- value, currency: the total or periodic contract value, if stated.
- governingLaw: the jurisdiction or applicable law, if stated.
- summary: two sentences at most describing what the contract is about.

${EXTRACTION_RULES}`;
