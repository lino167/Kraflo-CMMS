import { describe, it, expect } from 'vitest';
import { computeCriticalityScore, getHealthStatus } from '../report-utils';

describe('report-utils', () => {
  describe('computeCriticalityScore', () => {
    it('should calculate score correctly with default values', () => {
      const stats = {
        totalFalhas: 5,
        reincidencia: 20,
        mttr: 4.0,
        mtbf: 30.0
      };
      
      // score = (5 * 1.0) * (1.2 * 1.5) * (4.0 * 1.0) / 30 = 9 * 4 / 30 = 36 / 30 = 1.2
      const score = computeCriticalityScore(stats);
      expect(score).toBe(1.2);
    });

    it('should handle zero MTBF safely', () => {
      const stats = {
        totalFalhas: 1,
        reincidencia: 0,
        mttr: 2.0,
        mtbf: 0
      };
      // score = (1 * 1) * (1 * 1.5) * (2 * 1) / max(0, 1) = 3 / 1 = 3
      const score = computeCriticalityScore(stats);
      expect(score).toBe(3);
    });
  });

  describe('getHealthStatus', () => {
    it('should return critical for score >= 5', () => {
      expect(getHealthStatus(5.5)).toBe('critical');
    });

    it('should return warning for score >= 2', () => {
      expect(getHealthStatus(2.5)).toBe('warning');
    });

    it('should return good for score < 2', () => {
      expect(getHealthStatus(1.5)).toBe('good');
    });
  });
});
