import React from 'react'

export interface ProviderProps {
  value?: any
  children: React.ReactNode | null
}

export type UseGraphReturnValue =
  | [any, (arg: any) => any, (arg: any) => any]
  | Array<[any, (arg: any) => any, (arg: any) => any]>

export interface GraphType {
  __isGraph: boolean
  value: any
  Provider: React.ComponentType<ProviderProps>
  useGraph: (...args: string[]) => Array<any>
  Context: React.Context<any>
}

export type GraphValueEntryType = GraphType | any

export type GraphValueInputType = {
  [key: string]: GraphValueEntryType
}

export type GraphContextType = [any, (arg: any) => any, ...any[]]
