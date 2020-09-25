export type Item<D, M, K> = D & M & K

export type ItemData<I extends Item<any, any, any>> = I extends Item<
  infer D,
  any,
  any
>
  ? D
  : never

export type ItemMeta<I extends Item<any, any, any>> = I extends Item<
  any,
  infer M,
  any
>
  ? M
  : never

export type ItemKey<I extends Item<any, any, any>> = I extends Item<
  any,
  any,
  infer K
>
  ? K
  : never
