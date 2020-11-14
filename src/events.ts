export type Event<
  T extends EventPayloadMap,
  M extends EventMetaBase<T>,
  N extends EventName<T> = EventName<T>
> = { payload: EventPayload<T, N> } & M

export type EventPayloadMap = { [name: string]: any }

export type EventName<T extends EventPayloadMap> = keyof T

export type EventMetaBase<T extends EventPayloadMap> = { name: EventName<T> }

export type EventPayload<
  T extends EventPayloadMap,
  N extends EventName<T> = EventName<T>
> = T[N]
