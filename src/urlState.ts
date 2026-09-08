import { defaultModel, makeId, validateModel } from './model'
import type { TrussModel } from './types'

interface StoredLoad { name: string; position: number; massKg: number }

export function serializeModel(model: TrussModel): string {
  const params = new URLSearchParams()
  params.set('v', '1')
  params.set('length', String(model.length))
  params.set('massPerMeter', String(model.massPerMeter))
  params.set('loads', JSON.stringify(model.loads.map(({ name, position, massKg }) => ({ name, position, massKg }))))
  params.set('hangers', JSON.stringify(model.hangers.map(({ position }) => position)))
  return params.toString()
}

export function parseModel(search: string): { model: TrussModel; warning: string | null } {
  const params = new URLSearchParams(search)
  if (!params.has('v') && !params.has('length')) return { model: defaultModel(), warning: null }

  try {
    if (params.get('v') !== '1') throw new Error('Unsupported link version')
    const storedLoads = JSON.parse(required(params, 'loads')) as StoredLoad[]
    const storedHangers = JSON.parse(required(params, 'hangers')) as number[]
    if (!Array.isArray(storedLoads) || !Array.isArray(storedHangers)) throw new Error('Invalid arrays')

    const model: TrussModel = {
      length: Number(required(params, 'length')),
      massPerMeter: Number(required(params, 'massPerMeter')),
      loads: storedLoads.map((load) => ({
        id: makeId('load'),
        name: String(load.name),
        position: Number(load.position),
        massKg: Number(load.massKg),
      })),
      hangers: storedHangers.map((position) => ({ id: makeId('hanger'), position: Number(position) })),
    }
    if (validateModel(model).length) throw new Error('Invalid model')
    return { model, warning: null }
  } catch {
    return { model: defaultModel(), warning: 'This link contained invalid or unsupported data, so safe defaults were loaded.' }
  }
}

function required(params: URLSearchParams, name: string): string {
  const value = params.get(name)
  if (value === null) throw new Error(`Missing ${name}`)
  return value
}
