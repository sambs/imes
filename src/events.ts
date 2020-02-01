import { Readable } from 'stream'
import { Store } from './store'

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

export interface EventEmitter<T, M, K, P> {
  emit<N extends EventName<T>>(
    name: N,
    data: EventData<T, N>
  ): Promise<EmitResult<T, M, K, P, N>>
}

export interface EmitResult<T, M, K, P, N extends EventName<T>> {
  event: Event<T, M, K, N>
  updates: ProjectionUpdates<P>
}

export type EventStore<T, M, K> = Store<Event<T, M, K, EventName<T>>>

export interface EventStorer<T, M, K> {
  store: EventStore<T, M, K>
}

export interface PostEmit<T, M, K, P> {
  <N extends EventName<T>>(event: EmitResult<T, M, K, P, N>): void
}

// Reduced functionality interfaces between Events and Projections

export interface EventsProjection<T, M, K, I> {
  handleEvent<N extends EventName<T>>(
    event: Event<T, M, K, N>
  ): Promise<Array<I>>
}

export type EventsProjectionName<P> = keyof P

export type EventsProjections<T, M, K, P> = {
  [R in EventsProjectionName<P>]: EventsProjection<T, M, K, P[R]>
}

export type ProjectionUpdates<P> = {
  [R in EventsProjectionName<P>]: Array<P[R]>
}

export type GetKey<T, K> = <N extends EventName<T>>(
  name: N,
  data: EventData<T, N>
) => K

export type GetMeta<T, M> = <N extends EventName<T>>(
  name: N,
  data: EventData<T, N>
) => EventMeta<T, M, N>

export interface EventsOptions<T, M, K, P> {
  getKey: GetKey<T, K>
  getMeta: GetMeta<T, M>
  postEmit?: PostEmit<T, M, K, P>
  projections: EventsProjections<T, M, K, P>
  store: EventStore<T, M, K>
}

export class Events<T, M, K, P extends {}>
  implements EventEmitter<T, M, K, P>, EventStorer<T, M, K> {
  getKey: GetKey<T, K>
  getMeta: GetMeta<T, M>
  postEmit?: PostEmit<T, M, K, P>
  projections: EventsProjections<T, M, K, P>
  store: EventStore<T, M, K>

  constructor({
    getKey,
    getMeta,
    postEmit,
    projections,
    store,
  }: EventsOptions<T, M, K, P>) {
    this.getKey = getKey
    this.getMeta = getMeta
    this.postEmit = postEmit
    this.projections = projections
    this.store = store
  }

  async load(stream: Readable, options?: { write: boolean }) {
    options = { write: false, ...options }

    for await (const event of stream) {
      await this.updateProjections(event)

      if (options.write) {
        await this.store.write(event)
      }
    }
  }

  async emit<N extends EventName<T>>(
    name: N,
    data: EventData<T, N>
  ): Promise<EmitResult<T, M, K, P, N>> {
    const event = {
      data,
      meta: this.getMeta(name, data),
      key: this.getKey(name, data),
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
  ): Promise<ProjectionUpdates<P>> {
    let results: Partial<ProjectionUpdates<P>> = {}

    for (let key in this.projections) {
      const projection = this.projections[key]
      const result = await projection.handleEvent(event)
      results[key] = result
    }
    return results as ProjectionUpdates<P>
  }
}
