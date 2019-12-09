import React from 'react'

export interface ProviderProps {
  graphData?: any
  /** A list of subgraphs which should be ignored when rendering sub-providers.
   * If deduplicateProviders is trueThis list is automatically populated with subgrahps for which a provider already is known
   * to exist.
   */
  ignoreSubGraphs?: string[]
  /**
   * If true, graphs mounted multiple places will have their providers deduplicated.
   */
  deduplicateProviders?: boolean
  children: React.ReactNode | null
}

export type UseGraphReturnValue = [any, (arg: any) => any, (arg: any) => any]

export interface GraphType {
  id: string
  __isGraph: boolean
  initialGraph: any
  Provider: React.ComponentType<ProviderProps>
  useGraph: (...args: string[]) => UseGraphReturnValue
  Context: React.Context<any>
}

export type GraphValueEntryType = GraphType | any

export type GraphContextType = [any, (arg: any) => any, ...any[]]
