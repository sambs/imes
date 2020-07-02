import { Readable } from 'stream'
import { Store } from './store.js'

export type Event<T, M, K, N extends EventName<T> = EventName<T>> = {
  data: EventData<T, N>
  meta: EventMeta<T, M, N>
  key: K
}

export type EventName<T> = keyof T

export type EventData<T, N extends EventName<T> = EventName<T>> = T[N]

export type EventMeta<T, M, N extends EventName<T> = EventName<T>> = M & {
  name: N
}

export interface EventHandler<T, M, K, I> {
  handleEvent(event: Event<T, M, K>): Promise<I>
}

export type EventHandlerResult<
  J extends EventHandler<any, any, any, any>
> = J extends EventHandler<any, any, any, infer R> ? R : never

export type Projections<T, M, K> = {
  [key: string]: EventHandler<T, M, K, any>
}

export type ProjectionUpdates<T, M, K, P extends Projections<T, M, K>> = {
  [A in keyof P]: EventHandlerResult<P[A]>
}

export interface EmitResult<
  T,
  M,
  K,
  P extends Projections<T, M, K>,
  N extends EventName<T>
> {
  event: Event<T, M, K, N>
  updates: ProjectionUpdates<T, M, K, P>
}

export interface PostEmit<T, M, K, P extends Projections<T, M, K>> {
  <N extends EventName<T>>(event: EmitResult<T, M, K, P, N>): void
}

export interface EventEmitter<T, M, K, P extends Projections<T, M, K>, C> {
  emit<N extends EventName<T>>(
    name: N,
    data: EventData<T, N>,
    context: C
  ): Promise<EmitResult<T, M, K, P, N>>
}

export type EventStore<T, M, K> = Store<Event<T, M, K, EventName<T>>>

export interface EventStorer<T, M, K> {
  store: EventStore<T, M, K>
}

export type GetKey<T, K, C> = <N extends EventName<T>>(
  name: N,
  data: EventData<T, N>,
  context: C
) => K

export type GetMeta<T, M, C> = <N extends EventName<T>>(
  name: N,
  context: C
) => EventMeta<T, M, N>

export interface EventsOptions<T, M, K, P extends Projections<T, M, K>, C> {
  getKey: GetKey<T, K, C>
  getMeta: GetMeta<T, M, C>
  postEmit?: PostEmit<T, M, K, P>
  projections: P
  store: EventStore<T, M, K>
}

export class Events<T, M, K, P extends Projections<T, M, K>, C>
  implements EventEmitter<T, M, K, P, C>, EventStorer<T, M, K> {
  getKey: GetKey<T, K, C>
  getMeta: GetMeta<T, M, C>
  postEmit?: PostEmit<T, M, K, P>
  projections: P
  store: EventStore<T, M, K>

  constructor({
    getKey,
    getMeta,
    postEmit,
    projections,
    store,
  }: EventsOptions<T, M, K, P, C>) {
    this.getKey = getKey
    this.getMeta = getMeta
    this.postEmit = postEmit
    this.projections = projections
    this.store = store
  }

  async load(
    events: Readable | Iterable<Event<T, M, K>>,
    options?: { write: boolean }
  ) {
    options = { write: false, ...options }

    for await (const event of events) {
      await this.updateProjections(event)

      if (options.write) {
        await this.store.write(event)
      }
    }
  }

  async emit<N extends EventName<T>>(
    name: N,
    data: EventData<T, N>,
    context: C
  ): Promise<EmitResult<T, M, K, P, N>> {
    const event = {
      data,
      meta: this.getMeta(name, context),
      key: this.getKey(name, data, context),
    }

    await this.store.write(event)

    const updates = await this.updateProjections(event)

    if (this.postEmit !== undefined) {
      process.nextTick(() => {
        this.postEmit!<N>({ event, updates })
      })
    }

    return { event, updates }
  }

  async updateProjections<N extends EventName<T>>(
    event: Event<T, M, K, N>
  ): Promise<ProjectionUpdates<T, M, K, P>> {
    let updates: Partial<ProjectionUpdates<T, M, K, P>> = {}

    for (let key in this.projections) {
      const projection = this.projections[key]
      updates[key] = await projection.handleEvent(event)
    }
    return updates as ProjectionUpdates<T, M, K, P>
  }
}
