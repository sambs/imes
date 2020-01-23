import { Readable } from 'stream'
import { flatten } from 'fp-ts/lib/Array'
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

export interface ResolvedEvent<E, M extends EventName<E> = EventName<E>>
  extends Event<E, M> {
  updatedEdges: any[]
}

export interface Emitter<E, K> {
  emit<M extends EventName<E>>(
    name: M,
    data: EventData<E, M>
  ): Promise<ResolvedEvent<E, M>>
  store: EventStore<E, K>
}

export type EventStore<E, K> = Store<Event<E, EventName<E>>, K>

export interface IdGenerator {
  (): string
}

export interface GetTime {
  (): string
}

export interface PostEmit<E> {
  <M extends EventName<E>>(event: ResolvedEvent<E, M>): void
}

interface Projection<E> {
  handleEvent<M extends EventName<E>>(event: Event<E, M>): Promise<any>
}

type Projections<E> = {
  [key: string]: Projection<E>
}

export interface EventsOptions<E, K> {
  generateId?: IdGenerator
  getTime?: GetTime
  postEmit?: PostEmit<E>
  projections?: Projections<E>
  store: EventStore<E, K>
}

export class Events<E, K> implements Emitter<E, K> {
  generateId: IdGenerator
  getTime: GetTime
  postEmit?: PostEmit<E>
  projections: Projections<E>
  store: EventStore<E, K>

  constructor({
    generateId,
    getTime,
    postEmit,
    projections,
    store,
  }: EventsOptions<E, K>) {
    this.generateId = generateId || generateRandomId
    this.getTime = getTime || getCurrentTime
    this.postEmit = postEmit
    this.projections = projections || {}
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
  ): Promise<ResolvedEvent<E, M>> {
    const event = this.buildEvent(name, data)

    await this.store.write(event)

    const updatedEdges = await this.updateProjections(event)
    const resolvedEvent = { ...event, updatedEdges }

    if (this.postEmit !== undefined) {
      process.nextTick(() => {
        this.postEmit!<M>(resolvedEvent)
      })
    }

    return resolvedEvent
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
  ): Promise<Array<any>> {
    const jobs = await Promise.all(
      Object.keys(this.projections).map(key =>
        this.projections[key].handleEvent(event)
      )
    )
    return flatten(jobs)
  }
}
