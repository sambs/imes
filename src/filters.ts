export type ExactFilter<T> = {
  eq?: T
  ne?: T
  in?: Array<T>
}

export type OrdFilter<T> = {
  eq?: T
  gt?: T
  gte?: T
  lt?: T
  lte?: T
}

export type PrefixFilter = { prefix?: string }

export const exactPredicate = <T>({ eq, ne, in: _in }: ExactFilter<T>) => (
  x: T | null | undefined
) => {
  if (x === undefined || x === null) return false
  if (eq !== undefined && x !== eq) return false
  if (ne !== undefined && x === ne) return false
  if (_in !== undefined && !_in.includes(x)) return false
  else return true
}

export const ordPredicate = <T>({ eq, gt, lt, gte, lte }: OrdFilter<T>) => (
  x: T | null | undefined
) => {
  if (x === undefined || x === null) return false
  if (eq !== undefined && x !== eq) return false
  if (gt !== undefined && x <= gt) return false
  if (gte !== undefined && x < gte) return false
  if (lt !== undefined && x >= lt) return false
  if (lte !== undefined && x > lte) return false
  else return true
}

export const prefixPredicate = ({ prefix }: PrefixFilter) => (x?: string) => {
  if (x === undefined || x === null) return false
  if (prefix === undefined) return true
  else return x.startsWith(prefix)
}
