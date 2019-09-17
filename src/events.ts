import EventEmitter from 'events'
import { PubSub } from 'graphql-subscriptions'

import uuid from 'uuid'
import { Readable, Writable } from 'stream'

export interface Event {
  id: string
  time: string
  name: string
  data: any
  updatedNodes?: any[]
}

interface Projections {
  [name: string]: { handleEvent(event): any[] }
}

interface Options {
  id?(): string
  projections: Projections
  eventWriter: Writable
}

export class Events {
  projections: Projections
  eventWriter: Writable
  _emitter: EventEmitter
  _pubsub: PubSub

  constructor({ id, eventWriter, projections }: Options) {
    if (id) this._id = id
    this._emitter = new EventEmitter()
    this._pubsub = new PubSub()
    this.eventWriter = eventWriter
    this.projections = projections
  }

  _id(): string {
    return uuid.v4()
  }

  emit(name: string, data: any): Event {
    const event: Event = {
      id: this._id(),
      time: new Date().toISOString(),
      name,
      data,
    }
    this.eventWriter.write(event)
    event.updatedNodes = this._updateProjections(event)
    this._emitter.emit(name, event)
    this._pubsub.publish('*', { event })
    this._pubsub.publish(name, { [name]: event })
    return event
  }

  on(name: string, listener: (event: Event) => void) {
    this._emitter.on(name, listener)
  }

  asyncIterator<T>(event: string): AsyncIterator<T> {
    return this._pubsub.asyncIterator(event)
  }

  load(events: Readable): Promise<void> {
    return new Promise((resolve, reject) =>
      events
        .on('data', event => this._updateProjections(event))
        .on('error', reject)
        .on('end', resolve)
    )
  }

  _updateProjections(event: Event) {
    return Object.values(this.projections).reduce(
      (updatedNodes, projection) =>
        updatedNodes.concat(projection.handleEvent(event)),
      []
    )
  }
}
