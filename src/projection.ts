import { Event, EventName, EventByName } from './events'
import { QueryableStore } from './store'

export interface InitHandler<E extends Event, N extends EventName<E>, I, A> {
  init: (event: EventByName<E, N>) => Omit<I, keyof A>
}

export interface SingleTransformHandler<
  E extends Event,
  N extends EventName<E>,
  I,
  Y
> {
  selectOne: (event: EventByName<E, N>) => Y
  transform: (event: EventByName<E, N>, item: I) => I
}

export interface ManyTransformHandler<
  E extends Event,
  N extends EventName<E>,
  I,
  Q
> {
  selectMany: (event: EventByName<E, N>) => Q
  transform: (event: EventByName<E, N>, item: I) => I
}

export type Handler<E extends Event, N extends EventName<E>, I, Y, A, Q> =
  | InitHandler<E, N, I, A>
  | SingleTransformHandler<E, N, I, Y>
  | ManyTransformHandler<E, N, I, Q>

export const isInitHandler = <
  E extends Event,
  N extends EventName<E>,
  I,
  Y,
  A,
  Q
>(
  handler: Handler<E, N, I, Y, A, Q> | undefined
): handler is InitHandler<E, N, I, A> => {
  if (handler === undefined) return false
  return (handler as InitHandler<E, N, I, A>).init !== undefined
}

export const isSingleTransformHandler = <
  E extends Event,
  N extends EventName<E>,
  I,
  Y,
  A,
  Q
>(
  handler: Handler<E, N, I, Y, A, Q> | undefined
): handler is SingleTransformHandler<E, N, I, Y> => {
  if (handler === undefined) return false
  return (handler as SingleTransformHandler<E, N, I, Y>).selectOne !== undefined
}

export const isManyTransformHandler = <
  E extends Event,
  N extends EventName<E>,
  I,
  Y,
  A,
  Q
>(
  handler: Handler<E, N, I, Y, A, Q> | undefined
): handler is ManyTransformHandler<E, N, I, Q> => {
  if (handler === undefined) return false
  return (handler as ManyTransformHandler<E, N, I, Q>).selectMany !== undefined
}

export type ProjectionHandlers<E extends Event, I, Y, A, Q> = {
  [N in EventName<E>]?: Handler<E, N, I, Y, A, Q>
}

export interface ProjectionOptions<E extends Event, I, Y, A, Q> {
  handlers: ProjectionHandlers<E, I, Y, A, Q>
  initMeta: (event: E) => A
  store: QueryableStore<I, Y, Q>
  updateMeta: (event: E, item: I) => A
}

export class Projection<E extends Event, I, Y, A, Q> {
  handlers: ProjectionHandlers<E, I, Y, A, Q>
  initMeta: (event: E) => A
  store: QueryableStore<I, Y, Q>
  updateMeta: (event: E, item: I) => A

  constructor({
    initMeta,
    handlers,
    store,
    updateMeta,
  }: ProjectionOptions<E, I, Y, A, Q>) {
    this.handlers = handlers
    this.initMeta = initMeta
    this.store = store
    this.updateMeta = updateMeta
  }

  async handleEvent<N extends EventName<E>>(
    event: EventByName<E, N>
  ): Promise<Array<I>> {
    const handler = this.handlers[event.name]

    let items: Array<I> = []

    if (handler == undefined) {
      return []
    } else if (isInitHandler(handler)) {
      const item = ({
        ...handler.init(event),
        ...this.initMeta(event),
      } as unknown) as I
      items = [item]
      await this.store.create(item)
    } else {
      if (isSingleTransformHandler(handler)) {
        const item = await this.store.get(handler.selectOne(event))
        if (item !== undefined) items = [item]
      } else if (isManyTransformHandler(handler)) {
        const connection = await this.store.find(handler.selectMany(event))
        items = connection.items
      }
      items = items
        .map(item => handler.transform(event, item))
        .map(item => ({ ...item, ...this.updateMeta(event, item) }))
      await Promise.all(items.map(item => this.store.update(item)))
    }

    return items
  }
}
