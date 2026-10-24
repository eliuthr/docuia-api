import { resumeSchema } from './resume.schema.js';

const validResume = {
  fullName: 'Laura Martínez',
  email: 'laura@example.com',
  phone: null,
  location: 'Montería, Colombia',
  summary: 'Desarrolladora backend.',
  skills: ['TypeScript', 'NestJS'],
  experience: [
    {
      company: 'Acme',
      role: 'Backend developer',
      startDate: '2023-02',
      endDate: null,
    },
  ],
  education: [
    {
      institution: 'Universidad de Córdoba',
      degree: 'Ingeniería de Sistemas',
      endYear: 2022,
    },
  ],
};

describe('resumeSchema', () => {
  it('accepts a complete résumé', () => {
    expect(resumeSchema.parse(validResume)).toEqual(validResume);
  });

  it('rejects experience dates that are not YYYY-MM', () => {
    const result = resumeSchema.safeParse({
      ...validResume,
      experience: [{ ...validResume.experience[0], startDate: '2023-02-15' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a non-integer graduation year', () => {
    const result = resumeSchema.safeParse({
      ...validResume,
      education: [{ ...validResume.education[0], endYear: 2022.5 }],
    });

    expect(result.success).toBe(false);
  });
});
