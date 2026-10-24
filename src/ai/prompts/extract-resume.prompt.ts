import { EXTRACTION_RULES } from './extraction-rules.prompt.js';

export const EXTRACT_RESUME_PROMPT = `You extract structured data from résumés (CVs).

Fields:
- fullName, email, phone, location: the candidate's contact details.
- summary: two sentences at most describing the candidate's profile.
- skills: technical and professional skills, one per entry.
- experience: one entry per job; startDate and endDate use YYYY-MM.
  endDate is null when the job is current.
- education: one entry per degree or course; endYear is the graduation year.

${EXTRACTION_RULES}`;
