# A Typescript Event Sourcing Framework

With the event sourcing model, events are the source of truth. They contain facts - data related to events that have happened. Application state is derived from events by the way of projections. Projections are basically a fold over state and an event: `(Event, State) => State`. Projections are pure data transformations and cannot interact with any external systems. For example if an exchange rate is needed to derive a price it must be included in the event data not fetched from an api. Logically this makes sense as rates change over time and the projection is interested in the exchange rate at the time of the event, not the current exchange rate.

## Concurrency Conflicts

It should be noted that there is the potential for concurrency related conflicts. In the future a form of optimistic currency control could be implemented. However, for the time being its recommended this library be used for small projects where the risk of conflicts is low.
