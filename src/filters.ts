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

export const eqPredicate = <I, T>(pick: (item: I) => T) => (x: T) => (
  item: I
) => pick(item) === x

export const nePredicate = <I, T>(pick: (item: I) => T) => (x: T) => (
  item: I
) => pick(item) !== x

export const inPredicate = <I, T>(pick: (item: I) => T) => (x: T[]) => (
  item: I
) => x.includes(pick(item))

export const gtPredicate = <I, T>(pick: (item: I) => T) => (x: T) => (
  item: I
) => pick(item) > x

export const gtePredicate = <I, T>(pick: (item: I) => T) => (x: T) => (
  item: I
) => pick(item) >= x

export const ltPredicate = <I, T>(pick: (item: I) => T) => (x: T) => (
  item: I
) => pick(item) < x

export const ltePredicate = <I, T>(pick: (item: I) => T) => (x: T) => (
  item: I
) => pick(item) <= x

export const prefixPredicate = <I>(pick: (item: I) => string) => (
  x: string
) => (item: I) => pick(item).startsWith(x)

export const exactPredicates = <I, T>(pick: (item: I) => T) => ({
  eq: eqPredicate(pick),
  ne: nePredicate(pick),
  in: inPredicate(pick),
})

export const ordPredicates = <I, T>(pick: (item: I) => T) => ({
  eq: eqPredicate(pick),
  gt: gtPredicate(pick),
  gte: gtePredicate(pick),
  lt: ltPredicate(pick),
  lte: ltePredicate(pick),
})
