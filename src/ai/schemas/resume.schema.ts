import { z } from 'zod';
import { nullableText, nullableYearMonth } from './schema-fields.js';

const workExperienceSchema = z.object({
  company: z.string(),
  role: nullableText,
  startDate: nullableYearMonth,
  // null también cuando es el trabajo actual.
  endDate: nullableYearMonth,
});

const educationSchema = z.object({
  institution: z.string(),
  degree: nullableText,
  endYear: z.int().nullable(),
});

export const resumeSchema = z.object({
  fullName: nullableText,
  email: nullableText,
  phone: nullableText,
  location: nullableText,
  summary: nullableText,
  skills: z.array(z.string()),
  experience: z.array(workExperienceSchema),
  education: z.array(educationSchema),
});

export type ResumeData = z.infer<typeof resumeSchema>;
