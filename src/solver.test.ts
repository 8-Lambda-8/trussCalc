import { describe, expect, it } from 'vitest'
import { calculateTruss, GRAVITY } from './solver'
import type { TrussModel } from './types'

function model(overrides: Partial<TrussModel> = {}): TrussModel {
  return {
    length: 10,
    massPerMeter: 0,
    loads: [],
    hangers: [{ id: 'a', position: 0 }, { id: 'b', position: 10 }],
    ...overrides,
  }
}

describe('calculateTruss', () => {
  it('solves a central point load on a simply supported beam', () => {
    const result = calculateTruss(model({ loads: [{ id: 'p', name: 'Center', position: 5, massKg: 100 }] }))
    expect(result.hangers[0].reactionN).toBeCloseTo(50 * GRAVITY, 6)
    expect(result.hangers[1].reactionN).toBeCloseTo(50 * GRAVITY, 6)
    expect(result.maxMomentNm).toBeCloseTo(100 * GRAVITY * 10 / 4, 5)
    expect(result.maxMomentPosition).toBeCloseTo(5, 8)
    expect(result.centerOfMass).toBe(5)
  })

  it('solves an off-center point load', () => {
    const result = calculateTruss(model({ loads: [{ id: 'p', name: 'Offset', position: 2, massKg: 100 }] }))
    expect(result.hangers[0].reactionN).toBeCloseTo(80 * GRAVITY, 5)
    expect(result.hangers[1].reactionN).toBeCloseTo(20 * GRAVITY, 5)
    expect(result.maxMomentPosition).toBeCloseTo(2, 8)
  })

  it('solves uniform self-weight', () => {
    const result = calculateTruss(model({ massPerMeter: 20 }))
    expect(result.totalMassKg).toBe(200)
    expect(result.hangers[0].reactionN).toBeCloseTo(100 * GRAVITY, 5)
    expect(result.hangers[1].reactionN).toBeCloseTo(100 * GRAVITY, 5)
    expect(result.maxMomentNm).toBeCloseTo(20 * GRAVITY * 10 ** 2 / 8, 5)
    expect(result.maxMomentPosition).toBeCloseTo(5, 8)
  })

  it('solves a symmetric three-support continuous beam', () => {
    const result = calculateTruss(model({
      massPerMeter: 10,
      hangers: [{ id: 'a', position: 0 }, { id: 'b', position: 5 }, { id: 'c', position: 10 }],
    }))
    const w = 10 * GRAVITY
    expect(result.hangers[0].reactionN).toBeCloseTo(3 * w * 5 / 8, 4)
    expect(result.hangers[1].reactionN).toBeCloseTo(5 * w * 5 / 4, 4)
    expect(result.hangers[2].reactionN).toBeCloseTo(3 * w * 5 / 8, 4)
    expect(Math.abs(result.maxMomentNm)).toBeCloseTo(w * 25 / 8, 4)
  })

  it('marks a negative overhang reaction slack and reports instability', () => {
    const result = calculateTruss(model({
      loads: [{ id: 'p', name: 'Overhang', position: 10, massKg: 100 }],
      hangers: [{ id: 'a', position: 0 }, { id: 'b', position: 2 }],
    }))
    expect(result.hangers[0].slack).toBe(true)
    expect(result.warning).toMatch(/unstable/i)
  })

  it('handles a zero-load beam', () => {
    const result = calculateTruss(model())
    expect(result.totalForceN).toBe(0)
    expect(result.centerOfMass).toBeNull()
    expect(result.maxMomentNm).toBe(0)
  })
})
