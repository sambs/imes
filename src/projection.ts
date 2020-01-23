import { Event, EventName } from './events'
import { QueryableStore } from './store'

export interface Edge<N> {
  createdAt: string
  eventIds: string[]
  node: N
  typename: string
  updatedAt: string
}

export interface InitHandler<E, M extends EventName<E>, N> {
  init: (event: Event<E, M>) => N
}

export interface SingleTransformHandler<E, M extends EventName<E>, N, K> {
  selectOne: (event: Event<E, M>) => K
  transform: (event: Event<E, M>, node: N) => N
}

export interface ManyTransformHandler<E, M extends EventName<E>, N, Q> {
  selectMany: (event: Event<E, M>) => Q
  transform: (event: Event<E, M>, node: N) => N
}

export type Handler<E, M extends EventName<E>, N, K, Q> =
  | InitHandler<E, M, N>
  | SingleTransformHandler<E, M, N, K>
  | ManyTransformHandler<E, M, N, Q>

export const isInitHandler = <E, M extends EventName<E>, N, K, Q>(
  handler: Handler<E, M, N, K, Q> | undefined
): handler is InitHandler<E, M, N> => {
  if (handler === undefined) return false
  return (handler as InitHandler<E, M, N>).init !== undefined
}

export const isSingleTransformHandler = <E, M extends EventName<E>, N, K, Q>(
  handler: Handler<E, M, N, K, Q> | undefined
): handler is SingleTransformHandler<E, M, N, K> => {
  if (handler === undefined) return false
  return (handler as SingleTransformHandler<E, M, N, K>).selectOne !== undefined
}

export const isManyTransformHandler = <E, M extends EventName<E>, N, K, Q>(
  handler: Handler<E, M, N, K, Q> | undefined
): handler is ManyTransformHandler<E, M, N, Q> => {
  if (handler === undefined) return false
  return (handler as ManyTransformHandler<E, M, N, Q>).selectMany !== undefined
}

export type ProjectionHandlers<E, N, K, Q> = {
  [M in EventName<E>]?: Handler<E, M, N, K, Q>
}

export interface ProjectionOptions<E, N, K, Q> {
  handlers: ProjectionHandlers<E, N, K, Q>
  store: QueryableStore<Edge<N>, K, Q>
  typename: string
}

export class Projection<E, N, K, Q> {
  handlers: ProjectionHandlers<E, N, K, Q>
  store: QueryableStore<Edge<N>, K, Q>
  typename: string

  constructor({ handlers, store, typename }: ProjectionOptions<E, N, K, Q>) {
    this.handlers = handlers
    this.store = store
    this.typename = typename
  }

  async handleEvent<M extends EventName<E>>(
    event: Event<E, M>
  ): Promise<Edge<N>[]> {
    const handler = this.handlers[event.name]

    let edges: Edge<N>[] = []

    if (handler == undefined) {
      return []
    } else if (isInitHandler(handler)) {
      edges = [
        {
          createdAt: event.time,
          eventIds: [event.id],
          node: handler.init(event),
          typename: this.typename,
          updatedAt: event.time,
        },
      ]
    } else {
      if (isSingleTransformHandler(handler)) {
        const edge = await this.store.read(handler.selectOne(event))
        if (edge !== undefined) edges = [edge]
      } else if (isManyTransformHandler(handler)) {
        const connection = await this.store.find(handler.selectMany(event))
        edges = connection.items
      }
      edges = edges.map(edge => ({
        ...edge,
        node: handler.transform(event, edge.node),
        updatedAt: event.time,
        eventIds: [...edge.eventIds, event.id],
      }))
    }

    await Promise.all(edges.map(edge => this.store.write(edge)))

    return edges
  }
}
