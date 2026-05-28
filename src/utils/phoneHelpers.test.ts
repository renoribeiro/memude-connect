import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  formatPhoneDisplay,
  isValidBrazilianPhone,
  cleanPhoneNumber,
} from './phoneHelpers';

describe('phoneHelpers', () => {
  describe('normalizePhoneNumber', () => {
    it('should format numbers with Brazilian DDI (55) correctly', () => {
      expect(normalizePhoneNumber('(85) 99622-7722')).toBe('5585996227722');
      expect(normalizePhoneNumber('85996227722')).toBe('5585996227722');
      expect(normalizePhoneNumber('85 99622-7722')).toBe('5585996227722');
      expect(normalizePhoneNumber('+55 85 99622-7722')).toBe('5585996227722');
    });

    it('should handle already normalized 13-digit numbers', () => {
      expect(normalizePhoneNumber('5585996227722')).toBe('5585996227722');
    });

    it('should prepend 55 to 11-digit or 12-digit inputs', () => {
      expect(normalizePhoneNumber('85996227722')).toBe('5585996227722');
      expect(normalizePhoneNumber('21988887777')).toBe('5521988887777');
    });

    it('should assume DDD 85 for 9 or 10-digit numbers', () => {
      expect(normalizePhoneNumber('996227722')).toBe('5585996227722');
      expect(normalizePhoneNumber('8596227722')).toBe('55858596227722'); // 10 digits gets DDD 85 assumed if treated generically as standard phone
    });

    it('should handle null, undefined and empty string gracefully', () => {
      expect(normalizePhoneNumber(null)).toBe('');
      expect(normalizePhoneNumber(undefined)).toBe('');
      expect(normalizePhoneNumber('')).toBe('');
    });
  });

  describe('formatPhoneDisplay', () => {
    it('should format normalized number into display format (DD) XXXXX-XXXX', () => {
      expect(formatPhoneDisplay('5585996227722')).toBe('(85) 99622-7722');
    });

    it('should return the original string if length is not 13', () => {
      expect(formatPhoneDisplay('123456')).toBe('123456');
    });

    it('should return empty string on null, undefined or empty input', () => {
      expect(formatPhoneDisplay(null)).toBe('');
      expect(formatPhoneDisplay(undefined)).toBe('');
    });
  });

  describe('isValidBrazilianPhone', () => {
    it('should validate standard Brazilian cellular numbers correctly', () => {
      expect(isValidBrazilianPhone('(85) 99622-7722')).toBe(true);
      expect(isValidBrazilianPhone('5585996227722')).toBe(true);
    });

    it('should fail invalid formats, short inputs or non-mobile numbers', () => {
      expect(isValidBrazilianPhone('123456789')).toBe(false);
      expect(isValidBrazilianPhone('551155554444')).toBe(false); // Mobile must start with 9
      expect(isValidBrazilianPhone('')).toBe(false);
    });
  });

  describe('cleanPhoneNumber', () => {
    it('should strip all non-digit characters', () => {
      expect(cleanPhoneNumber('+55 (85) 99622-7722')).toBe('5585996227722');
      expect(cleanPhoneNumber('abc-123')).toBe('123');
    });
  });
});
