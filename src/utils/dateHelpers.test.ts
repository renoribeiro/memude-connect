import { describe, it, expect } from 'vitest';
import {
  subDays,
  startOfMonth,
  endOfMonth,
  parseLocalDate,
  isSameLocalDay,
  isToday,
  isTomorrow,
  isPast,
  normalizeTime,
} from './dateHelpers';

describe('dateHelpers', () => {
  describe('subDays', () => {
    it('should subtract days correctly', () => {
      const baseDate = new Date(2026, 4, 15); // May 15
      const result = subDays(baseDate, 5);
      expect(result.getDate()).toBe(10);
      expect(result.getMonth()).toBe(4);
    });
  });

  describe('startOfMonth', () => {
    it('should return first day of month', () => {
      const date = new Date(2026, 4, 15); // May 15
      const result = startOfMonth(date);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(4);
    });
  });

  describe('endOfMonth', () => {
    it('should return last day of month correctly', () => {
      const date = new Date(2026, 4, 15); // May 15
      const result = endOfMonth(date);
      expect(result.getDate()).toBe(31); // May has 31 days
    });

    it('should handle leap years correctly', () => {
      const date = new Date(2024, 1, 15); // Feb 15, 2024 (Leap year)
      const result = endOfMonth(date);
      expect(result.getDate()).toBe(29);
    });
  });

  describe('parseLocalDate', () => {
    it('should parse YYYY-MM-DD string as local timezone date', () => {
      const dateString = '2026-05-28';
      const parsed = parseLocalDate(dateString);
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(4); // 0-indexed May
      expect(parsed.getDate()).toBe(28);
    });
  });

  describe('isSameLocalDay', () => {
    it('should check if dates represent the same day', () => {
      const date1 = new Date(2026, 4, 28, 10, 0, 0);
      const date2 = new Date(2026, 4, 28, 22, 0, 0);
      expect(isSameLocalDay(date1, date2)).toBe(true);
    });

    it('should support checking with string inputs', () => {
      const date1 = '2026-05-28';
      const date2 = new Date(2026, 4, 28);
      expect(isSameLocalDay(date1, date2)).toBe(true);
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });
  });

  describe('isTomorrow', () => {
    it('should return true for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isTomorrow(tomorrow)).toBe(true);
    });
  });

  describe('isPast', () => {
    it('should correctly mark past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 2);
      expect(isPast(past)).toBe(true);
    });
  });

  describe('normalizeTime', () => {
    it('should slice HH:MM:SS to HH:MM', () => {
      expect(normalizeTime('14:30:00')).toBe('14:30');
      expect(normalizeTime('09:15')).toBe('09:15');
    });

    it('should return empty string if null, undefined or empty is provided', () => {
      expect(normalizeTime(null)).toBe('');
      expect(normalizeTime(undefined)).toBe('');
    });
  });
});
