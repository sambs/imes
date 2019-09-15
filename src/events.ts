import EventEmitter from 'events'
import { Readable, Writable } from 'stream'
import * as stream from 'stream'

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

const processEvent = (projections: Projections, event: any) =>
  Object.values(projections).reduce(
    (updatedNodes, projection) =>
      updatedNodes.concat(projection.handleEvent(event)),
    []
  )

export const initState = ({
  projections,
  eventReader,
}: {
  projections: Projections
  eventReader: Readable
}) =>
  new Promise((resolve, reject) =>
    eventReader
      .on('data', (event: string) => processEvent(projections, event))
      .on('error', reject)
      .on('end', resolve)
  )

export const createEmitter = ({
  id,
  projections,
  events,
  eventWriter,
}: {
  id(): string
  projections: Projections
  events: EventEmitter
  eventWriter: Writable
}) => (name: string, data: any): Event => {
  const event: Event = {
    id: id(),
    time: new Date().toISOString(),
    name,
    data,
  }
  eventWriter.write(event)
  event.updatedNodes = processEvent(projections, event)
  events.emit(name, event)
  return event
}
