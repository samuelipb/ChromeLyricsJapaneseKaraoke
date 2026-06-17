import { describe, it, expect } from 'vitest';
import { wipeProgress } from '../lib/sync/wipe';

describe('wipeProgress', () => {
  it('0 al inicio, 0.5 a la mitad, 1 al final', () => {
    expect(wipeProgress(10, 10, 20)).toBe(0);
    expect(wipeProgress(15, 10, 20)).toBe(0.5);
    expect(wipeProgress(20, 10, 20)).toBe(1);
  });
  it('clamp fuera del rango', () => {
    expect(wipeProgress(5, 10, 20)).toBe(0);
    expect(wipeProgress(99, 10, 20)).toBe(1);
  });
  it('rango inválido (tEnd<=tStart): 0 antes, 1 al alcanzar tEnd', () => {
    expect(wipeProgress(10, 20, 20)).toBe(0);
    expect(wipeProgress(20, 20, 20)).toBe(1);
  });
});
