import { describe, expect, it } from 'vitest'
import { parseModel, serializeModel } from './urlState'
import type { TrussModel } from './types'

describe('URL state', () => {
  it('round-trips the full input model including Unicode names', () => {
    const model: TrussModel = {
      length: 12.5,
      massPerMeter: 8.75,
      loads: [{ id: 'local', name: 'Bühne 🎵', position: 3.2, massKg: 123.4 }],
      hangers: [{ id: 'one', position: 1 }, { id: 'two', position: 11.5 }],
    }
    const parsed = parseModel(`?${serializeModel(model)}`)
    expect(parsed.warning).toBeNull()
    expect(parsed.model).toMatchObject({
      length: model.length,
      massPerMeter: model.massPerMeter,
      loads: [{ name: 'Bühne 🎵', position: 3.2, massKg: 123.4 }],
      hangers: [{ position: 1 }, { position: 11.5 }],
    })
  })

  it('loads safe defaults for malformed data', () => {
    const parsed = parseModel('?v=1&length=nope&loads=[]&hangers=[]')
    expect(parsed.warning).toBeTruthy()
    expect(parsed.model.length).toBe(10)
  })
})
