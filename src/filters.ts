export type EqualFilter<T> = {
  eq?: T
}

export type SizeFilter<T> = {
  eq?: T
  gt?: T
  gte?: T
  lt?: T
  lte?: T
}

export type EnumFilter<T> = {
  in?: Array<T>
}

export type PrefixFilter = { prefix?: string }

export const equalPredicate = <T>({ eq }: EqualFilter<T>) => (
  x: T | null | undefined
) => {
  if (x === undefined || x === null) return false
  if (eq === undefined) return true
  else return x === eq
}

export const sizePredicate = <T>({ eq, gt, lt, gte, lte }: SizeFilter<T>) => (
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

export const enumPredicate = <T>(filter: EnumFilter<T>) => (
  x: T | null | undefined
) => {
  if (x === undefined || x === null) return false
  if (filter.in === undefined) return true
  else return filter.in.includes(x)
}

export const prefixPredicate = ({ prefix }: PrefixFilter) => (x?: string) => {
  if (x === undefined || x === null) return false
  if (prefix === undefined) return true
  else return x.startsWith(prefix)
}
