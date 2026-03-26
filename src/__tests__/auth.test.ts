import { describe, it, expect } from 'vitest'

// Helper extracted from Auth.tsx logic
const validatePassword = (pass: string) => {
  const feedback: string[] = [];
  if (pass.length < 12) feedback.push("Mínimo 12 caracteres");
  if (!/[A-Z]/.test(pass)) feedback.push("Una mayúscula");
  if (!/[a-z]/.test(pass)) feedback.push("Una minúscula");
  if (!/[0-9]/.test(pass)) feedback.push("Un número");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) feedback.push("Un símbolo");
  
  let score = 0;
  if (pass.length >= 8) score++;
  if (pass.length >= 12) score++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pass)) score++;
  
  return { score, feedback };
};

describe('Password Policy Audit', () => {
  it('should reject passwords shorter than 12 characters', () => {
    const result = validatePassword('Pass123!');
    expect(result.score).toBeLessThan(5);
    expect(result.feedback).toContain('Mínimo 12 caracteres');
  })

  it('should reject passwords without symbols', () => {
    const result = validatePassword('Password12345');
    expect(result.score).toBeLessThan(5);
    expect(result.feedback).toContain('Un símbolo');
  })

  it('should accept 12+ char passwords with all requirements', () => {
    const result = validatePassword('AlconSurgical2024!');
    expect(result.score).toBe(5);
    expect(result.feedback).toHaveLength(0);
  })

  it('should reject passwords without uppercase', () => {
    const result = validatePassword('alcon2024surgical!');
    expect(result.score).toBeLessThan(5);
    expect(result.feedback).toContain('Una mayúscula');
  })
})
