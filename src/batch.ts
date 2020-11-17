import { Query, Store } from './store'
import { ProxyStore } from './proxy'

type BatchJob<I, K> = {
  key: K
  promise: Promise<I | undefined>
  resolve: (item: I | undefined) => void
  reject: (error: Error) => void
  status: 'Waiting' | 'InFlight' | 'Complete'
}

export class BatchProxyStore<
  I extends {},
  K,
  Q extends Query
> extends ProxyStore<I, K, Q> {
  jobs: { [key: string]: BatchJob<I, K> }
  scheduled: boolean

  constructor(store: Store<I, K, Q>) {
    super(store)
    this.jobs = {}
    this.scheduled = false
  }

  async get(key: K): Promise<I | undefined> {
    const jobs = this.jobs
    const stringKey = this.keyToString(key)

    if (jobs[stringKey]) {
      return jobs[stringKey].promise
    }

    const job: Partial<BatchJob<I, K>> = { key, status: 'Waiting' }

    job.promise = new Promise<I | undefined>((resolve, reject) => {
      job.resolve = resolve
      job.reject = reject
    })

    jobs[stringKey] = job as BatchJob<I, K>

    this.schedule()

    return job.promise
  }

  private async schedule() {
    if (!this.scheduled) {
      process.nextTick(() => this.dispatch())
    }
  }

  private async dispatch() {
    this.scheduled = false

    const batch = Object.values(this.jobs).filter(
      ({ status }) => status == 'Waiting'
    )

    batch.forEach(job => {
      job.status = 'InFlight'
    })

    if (batch.length == 1) {
      const { key, resolve, reject } = batch[0]
      await super.get(key).then(resolve, reject)
    } else if (batch.length) {
      await super.getMany(batch.map(({ key }) => key)).then(
        items => {
          batch.forEach(({ resolve }, index) => {
            resolve(items[index])
          })
        },
        error => {
          batch.forEach(({ reject }) => reject(error))
        }
      )
    }

    batch.forEach(job => {
      job.status = 'Complete'
    })

    this.jobs = Object.fromEntries(
      Object.entries(this.jobs).filter(
        ([_key, { status }]) => status != 'Complete'
      )
    )
  }
}
