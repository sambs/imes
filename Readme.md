# In-Memory Event Sourcing Framework

### Events

Events are source of truth within the system. They contain facts - information about things that have happened.

### Projections

State is derived from events by the way of projections. Projections are basically a fold over state and an event: `State => Event => State`. Projections are pure data transformations and cannot interact with any external systems. For example if an exchange rate is needed to derive a price it must be included in the event data not fetched from an api, as rates may change when events are replayed.

### Commands

Commands validate input, check permissions and emit one or more events. They may query or call external services such as a payment provider.

A simple command will map one to one with an event, for example a createPost command might emit a single PostCreated event. Something like a takePayment command might emit a PaymentInitiated and PaymentCompleted or PaymentFailed event.

### Event Handlers

Much like Commands, event handlers can query or call external services and emit further events but do not perform any validation as they do not have the option to reject an event. Sending a confirmation email is an example of something suited to being implemented in an event handler.
### Event Replay

Events can be replayed when projections are modified, permitting changes to the shape of the application state. Event handlers are not triggered when events are replayed as this would result in unwanted external effects such as emails being sent twice.

### Concurrency Conflicts

Projections are derived synchronously in response to events, so commands can reliably check application state, perform validations and reject invalid requests. Fo example if the takePayment command emits a PaymentInitiated event the status of a payment will immediately change to IN_PROGRESS and subsequent calls to takePayment can be rejected.

In the case of less semantic operations such as general purpose update commands, optimistic concurrency control could be implemented at the command level. A version number could be stored against the projected entity, incremented by every event its modified by. Commands would need to include an expectedVersion parameter and check the provided version number matches the stored one. The need for this type of check might be mitigated by subscriptions pushing changes to the client.
