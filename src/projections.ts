import { Store } from './store'

import {
  Event,
  EventPayloadMap,
  EventMetaBase,
  EventHandler,
  EventName,
} from './events'

export interface InitHandler<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A
> {
  init: (event: Event<T, M, N>) => Omit<I, keyof A>
}

export interface SingleTransformHandler<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  K
> {
  selectOne: (event: Event<T, M, N>) => K
  transform: (event: Event<T, M, N>, item: I) => I
}

export interface ManyTransformHandler<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  Q
> {
  selectMany: (event: Event<T, M, N>) => Q
  transform: (event: Event<T, M, N>, item: I) => I
}

export type Handler<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A,
  K,
  Q
> =
  | InitHandler<T, M, N, I, A>
  | SingleTransformHandler<T, M, N, I, K>
  | ManyTransformHandler<T, M, N, I, Q>

export const isInitHandler = <
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A,
  K,
  Q
>(
  handler: Handler<T, M, N, I, A, K, Q> | undefined
): handler is InitHandler<T, M, N, I, A> => {
  if (handler === undefined) return false
  return (handler as InitHandler<T, M, N, I, A>).init !== undefined
}

export const isSingleTransformHandler = <
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A,
  K,
  Q
>(
  handler: Handler<T, M, N, I, A, K, Q> | undefined
): handler is SingleTransformHandler<T, M, N, I, K> => {
  if (handler === undefined) return false
  return (
    (handler as SingleTransformHandler<T, M, N, I, K>).selectOne !== undefined
  )
}

export const isManyTransformHandler = <
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T>,
  I,
  A,
  K,
  Q
>(
  handler: Handler<T, M, N, I, A, K, Q> | undefined
): handler is ManyTransformHandler<T, M, N, I, Q> => {
  if (handler === undefined) return false
  return (
    (handler as ManyTransformHandler<T, M, N, I, Q>).selectMany !== undefined
  )
}

export type ProjectionHandlers<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  I,
  A,
  K,
  Q
> = {
  [N in EventName<T>]?: Handler<T, M, N, I, A, K, Q>
}

export type ProjectionUpdates<I> = Array<{ current: I; previous?: I }>

export interface ProjectionOptions<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  I extends A, // Stored item
  A, // Item meta
  K, // Item store key
  Q // Item store query
> {
  handlers: ProjectionHandlers<T, M, I, A, K, Q>
  initMeta: (event: Event<T, M>) => A
  store: Store<I, K, Q>
  updateMeta: (event: Event<T, M>, item: I) => A
}

export class Projection<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  I extends A, // Stored item
  A, // Item meta
  K, // Item store key
  Q // Item store query
> implements EventHandler<T, M, Array<I>> {
  handlers: ProjectionHandlers<T, M, I, A, K, Q>
  initMeta: (event: Event<T, M>) => A
  store: Store<I, K, Q>
  updateMeta: (event: Event<T, M>, item: I) => A

  constructor({
    initMeta,
    handlers,
    store,
    updateMeta,
  }: ProjectionOptions<T, M, I, A, K, Q>) {
    this.handlers = handlers
    this.initMeta = initMeta
    this.store = store
    this.updateMeta = updateMeta
  }

  async getUpdates<N extends EventName<T>>(
    event: Event<T, M, N>
  ): Promise<ProjectionUpdates<I>> {
    const handler = this.handlers[event.name]

    if (handler == undefined) {
      return []
    } else if (isInitHandler(handler)) {
      return [
        {
          current: {
            ...handler.init(event),
            ...this.initMeta(event),
          } as I,
        },
      ]
    } else {
      let items: Array<I> = []

      if (isSingleTransformHandler(handler)) {
        const item = await this.store.get(handler.selectOne(event))
        if (item !== undefined) items = [item]
      } else if (isManyTransformHandler(handler)) {
        const connection = await this.store.find(handler.selectMany(event))
        items = connection.items
      }

      return items.map(item => {
        const transformed = handler.transform(event, item)
        return {
          previous: item,
          current: { ...transformed, ...this.updateMeta(event, transformed) },
        }
      })
    }
  }

  async writeUpdates<N extends EventName<T>>(
    event: Event<T, M, N>
  ): Promise<ProjectionUpdates<I>> {
    const updates = await this.getUpdates(event)

    await Promise.all(
      updates.map(({ previous, current }) =>
        previous ? this.store.update(current) : this.store.create(current)
      )
    )

    return updates
  }

  async handleEvent<N extends EventName<T>>(
    event: Event<T, M, N>
  ): Promise<Array<I>> {
    const updates = await this.writeUpdates(event)
    return updates.map(({ current }) => current)
  }
}

export type ProjectionMap<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>
> = {
  [key: string]: Projection<T, M, any, any, any, any>
}

export type InferProjectionItem<
  P extends Projection<any, any, any, any, any, any>
> = P extends Projection<any, any, infer I, any, any, any> ? I : never

export type ProjectionUpdatesMap<P extends ProjectionMap<any, any>> = {
  [N in keyof P]: ProjectionUpdates<InferProjectionItem<P[N]>>
}

export type FlatProjectionUpdatesMap<P extends ProjectionMap<any, any>> = {
  [N in keyof P]: Array<InferProjectionItem<P[N]>>
}

export async function getProjectionUpdates<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  P extends ProjectionMap<T, M>,
  N extends EventName<T> = EventName<T>
  // E extends Event<T, M> = Event<T, M>
>(projections: P, event: Event<T, M, N>): Promise<ProjectionUpdatesMap<P>> {
  const jobs: Array<Promise<[keyof P, any]>> = []

  for (let name in projections) {
    jobs.push(
      projections[name].getUpdates(event).then(result => [name, result])
    )
  }

  const updates = Object.fromEntries(await Promise.all(jobs))

  return updates as ProjectionUpdatesMap<P>
}

export async function writeProjectionUpdates<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  P extends ProjectionMap<T, M>,
  N extends EventName<T> = EventName<T>
>(projections: P, event: Event<T, M, N>): Promise<ProjectionUpdatesMap<P>> {
  const jobs: Array<Promise<[keyof P, any]>> = []

  for (let name in projections) {
    jobs.push(
      projections[name].writeUpdates(event).then(result => [name, result])
    )
  }

  const updates = Object.fromEntries(await Promise.all(jobs))

  return updates as ProjectionUpdatesMap<P>
}

export const flattenProjectionUpdates = <I>(updates: ProjectionUpdates<I>) =>
  updates.map(({ current }) => current)

export const flattenProjectionUpdatesMap = <P extends ProjectionMap<any, any>>(
  updates: ProjectionUpdatesMap<P>
) =>
  Object.fromEntries(
    Object.entries(updates).map(([name, updates]) => [
      name,
      flattenProjectionUpdates(updates),
    ])
  ) as FlatProjectionUpdatesMap<P>
