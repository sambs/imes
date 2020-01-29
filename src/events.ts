import { Readable } from 'stream'
import { Store } from './store'
import { generateRandomId, getCurrentTime } from './util'

export type EventName<E> = keyof E
export type EventData<E, N extends EventName<E>> = E[N]

export type Event<E, M extends EventName<E> = EventName<E>> = {
  name: M
  id: string
  time: string
  data: EventData<E, M>
}

export interface EventEmitter<E, P> {
  emit<M extends EventName<E>>(
    name: M,
    data: EventData<E, M>
  ): Promise<EmitResult<E, P, M>>
}

export type EventStore<E, K> = Store<Event<E, EventName<E>>, K>

export interface EventStorer<E, K> {
  store: EventStore<E, K>
}

export interface IdGenerator {
  (): string
}

export interface GetTime {
  (): string
}

export interface PostEmit<E, P> {
  <M extends EventName<E>>(event: EmitResult<E, P, M>): void
}

// Reduced functionality interfaces between Events and Projections

export interface EventsProjection<E, I> {
  handleEvent<M extends EventName<E>>(event: Event<E, M>): Promise<Array<I>>
}

export type EventsProjectionName<P> = keyof P

export type EventsProjections<E, P> = {
  [R in EventsProjectionName<P>]: EventsProjection<E, P[R]>
}

export type ProjectionUpdates<P> = {
  [R in EventsProjectionName<P>]: Array<P[R]>
}

export interface EmitResult<E, P, M extends EventName<E>> {
  event: Event<E, M>
  updates: ProjectionUpdates<P>
}

export interface EventsOptions<E, P, K> {
  generateId?: IdGenerator
  getTime?: GetTime
  postEmit?: PostEmit<E, P>
  projections: EventsProjections<E, P>
  store: EventStore<E, K>
}

export class Events<E, P extends {}, K>
  implements EventEmitter<E, P>, EventStorer<E, K> {
  generateId: IdGenerator
  getTime: GetTime
  postEmit?: PostEmit<E, P>
  projections: EventsProjections<E, P>
  store: EventStore<E, K>

  constructor({
    generateId,
    getTime,
    postEmit,
    projections,
    store,
  }: EventsOptions<E, P, K>) {
    this.generateId = generateId || generateRandomId
    this.getTime = getTime || getCurrentTime
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

  async emit<M extends EventName<E>>(
    name: M,
    data: EventData<E, M>
  ): Promise<EmitResult<E, P, M>> {
    const event = this.buildEvent(name, data)

    await this.store.write(event)

    const updates = await this.updateProjections(event)

    if (this.postEmit !== undefined) {
      process.nextTick(() => {
        this.postEmit!<M>({ event, updates })
      })
    }

    return { event, updates }
  }

  buildEvent<M extends EventName<E>>(
    name: M,
    data: EventData<E, M>
  ): Event<E, M> {
    return {
      id: this.generateId(),
      time: this.getTime(),
      name,
      data,
    }
  }

  async updateProjections<M extends EventName<E>>(
    event: Event<E, M>
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
