import React from 'react'

export type RecursiveGraphData<T> = {
  [P in keyof T]: T[P] extends GraphType<infer U>[]
    ? RecursiveGraphData<U>[]
    : T[P] extends GraphType<infer U>
    ? RecursiveGraphData<U>
    : T[P]
}
export type RecursiveGraphDataPartial<T> = {
  [P in keyof T]?: T[P] extends GraphType<infer U>[]
    ? RecursiveGraphDataPartial<Partial<U>>[]
    : T[P] extends GraphType<infer U>
    ? RecursiveGraphDataPartial<Partial<U>>
    : Partial<T[P]>
}

export interface ProviderProps<T> {
  graphData?: RecursiveGraphDataPartial<T>
  /** A list of subgraphs which should be ignored when rendering sub-providers.
   * If deduplicateProviders is true this list is automatically populated with subgraphs for which a provider already is known
   * to exist.
   */
  ignoreSubGraphs?: string[]
  /**
   * If true, graphs mounted multiple places will have their providers deduplicated.
   */
  deduplicateProviders?: boolean
  children: React.ReactNode | null
}

export type UpdateGraphFunctionType<T> = (
  partialGraph: RecursiveGraphDataPartial<T> | ((currentGraph: T) => RecursiveGraphDataPartial<T>)
) => void
export type BoundGraphFunctionType<T> = {
  [P in keyof T]: T[P]
} & {
  updateGraph: UpdateGraphFunctionType<T>
  setGraph: (newGraph: T) => void
}

export type UseGraphReturnValue<T> = [
  RecursiveGraphData<T>,
  UpdateGraphFunctionType<T>,
  (arg: T) => void
]
export interface GraphType<T> {
  id: string
  __isGraph: boolean
  initialGraph: T
  Provider: React.ComponentType<ProviderProps<T>>
  useGraph: () => UseGraphReturnValue<T>
  Context: React.Context<any>
}

export type GraphValueEntryType<T> = GraphType<T> | any

export type GraphContextType<T> = [T, RecursiveGraphData<T>, ...any[]]
