import React, { useContext, useState, useEffect, useRef } from 'react'
import isString from 'lodash/isString'
import isObject from 'lodash/isObject'
import isFunction from 'lodash/isFunction'
import isPlainObject from 'lodash/isPlainObject'
import isArray from 'lodash/isArray'
import isNumber from 'lodash/isNumber'
import union from 'lodash/union'
import uniqueId from 'lodash/uniqueId'
import {
  RecursiveGraphData,
  RecursiveGraphDataPartial,
  GraphContextType,
  GraphType,
  ProviderProps,
  UseGraphReturnValue,
  BoundGraphFunctionType,
  UpdateGraphFunctionType
} from './types'
import { isEqual } from 'lodash'

export function isGraph<T>(graph: any): graph is GraphType<T> {
  return graph && graph.__isGraph
}

export function useDefaultStatePopulator<T>(values: T) {
  return useState(values)
}

/**
 * Rebinds a function into a specific context. It is given a new "this"-object with the current
 * graph and two update
 *
 * @param func Any function.
 * @param graph The current graph data
 * @param updateGraph A context-bound update function which updates the graph by doing a deep merge.
 * @param setGraph A context-bound update function which replaces the graph.
 */
export function rebindFunction<T>(
  func: (args?: any) => void,
  graph: T,
  updateGraph: UpdateGraphFunctionType<T>,
  setGraph: (newGraph: T) => void
) {
  return func.bind({
    ...graph,
    updateGraph,
    setGraph
  })
}

/**
 * Rebinds all functions in a graph into a specific context. Calls the `rebindFunction` function.
 *
 * @param graph The current graph data
 * @param updateGraph A context-bound update function which updates the graph by doing a deep merge.
 * @param setGraph A context-bound update function which replaces the graph.
 */
export function rebindGraphFunctions<T>(
  graph: T,
  updateGraph: UpdateGraphFunctionType<T>,
  setGraph: (newGraph: T) => void
) {
  if (!isPlainObject(graph)) {
    return graph
  }
  return Object.keys(graph).reduce((acc: Record<string, any>, key: string) => {
    const val = graph[key as keyof T]
    if (!isFunction(val)) {
      acc[key] = val
      return acc
    } else {
      acc[key] = rebindFunction(val, graph, updateGraph, setGraph)
      return acc
    }
  }, {})
}

/**
 * Resolves all subgraphs in the current context.
 *
 * @param graph The current graph data
 * @param path Subpath specification to resolve
 */
export function resolveSubgraphs<T>(graph: T): T {
  if (isGraph(graph)) {
    return graph
  } else if (isPlainObject(graph)) {
    return Object.entries(graph).reduce((acc: Record<string, any>, [key, value]: [string, any]) => {
      if (isGraph(value)) {
        acc[key] = value.useGraph()[0]
      } else if (isObject(value)) {
        // is Object here means that it should be iterated over
        acc[key] = resolveSubgraphs(value)
      } else {
        acc[key] = value
      }
      return acc
    }, {}) as T
  } else if (isArray(graph)) {
    const _new = graph.map(data => {
      if (isGraph(data)) {
        return data.useGraph()[0]
      } else if (isObject(data)) {
        // is Object here means that it should be iterated over
        return resolveSubgraphs(data)
      }
      return data
    })
    return _new as any
  } else {
    return graph
  }
}

/**
 * Takes a state object, possibly containing subgraphs, and resolves all the
 * initial subgraph data.
 *
 * @param graphData Some state data
 */
export function resolveSubGraphsData(graphData: any): any {
  if (isGraph(graphData)) {
    return resolveSubGraphsData(graphData.initialGraph)
  } else if (isPlainObject(graphData)) {
    return Object.entries(graphData).reduce(
      (acc: Record<string, any>, [key, value]: [string, any]) => {
        if (isGraph(value)) {
          acc[key] = resolveSubGraphsData(value.initialGraph)
        } else if (isObject(value)) {
          // is Object here means that it should be iterated over
          acc[key] = resolveSubGraphsData(value)
        } else {
          acc[key] = value
        }
        return acc
      },
      {}
    )
  } else if (isArray(graphData)) {
    return graphData.map(data => {
      if (isGraph(data)) {
        return resolveSubGraphsData(data)
      }
      return data
    })
  } else {
    return graphData
  }
}

export function mergeGraphData<T>(graph: T, graphData: any): T {
  // The only thing we really care about and need to inject, is the non-graph values
  // The nested graph values will be taken care of by sending them into the subproviders, and hence
  // Does not need to be handled here.
  //
  // We do, however, need to worry about branches of the tree where there are graphs
  // more deeply nested. Hence we have to recurse through the entire graphData tree,
  // and try to find associated entries in the graph. If they exist, we have to
  // replace the existing values if and only if they are not graph's themselves,
  // or carry any graph's deeper down.
  //
  // Note that this method allows for "removing" subGraphs, by setting a value to a scalar.

  if (graphData === null || graphData === undefined || isString(graphData) || isNumber(graphData)) {
    return graphData
  } else if (isGraph(graph)) {
    return graph
  } else if (isArray(graphData)) {
    // For mismatching types, we assume that the end-users knows what they are doing, and
    // has overwritten nested graph-data.
    if (!isArray(graph)) {
      return graphData as any
    }

    const longestArray = Math.max(graphData.length, graph.length)
    const newArray = []

    for (let i = 0; i < longestArray; ++i) {
      const graphVal = graph[i]
      const graphDataVal = graphData[i]

      if (graphVal === undefined) {
        newArray.push(graphDataVal)
      } else if (graphDataVal === undefined) {
        newArray.push(graphVal)
      } else {
        newArray.push(mergeGraphData(graphVal, graphDataVal))
      }
    }

    return newArray as any
  } else if (isPlainObject(graphData)) {
    // For mismatching types, we assume that the end-users knows what they are doing, and
    // has overwritten nested graph-data.
    if (!isPlainObject(graph)) return graphData as any

    const graphKeys = Object.keys(graph)
    const graphDataKeys = Object.keys(graphData)
    const allKeys = union(graphKeys, graphDataKeys) as (keyof T)[]

    return allKeys.reduce((newGraph: Partial<T>, key: keyof T) => {
      const graphVal = graph[key]
      const graphDataVal = graphData[key]

      if (graphVal === undefined) {
        newGraph[key] = graphDataVal
      } else if (graphDataVal === undefined) {
        newGraph[key] = graphVal
      } else {
        newGraph[key] = mergeGraphData(graphVal, graphDataVal)
      }
      return newGraph
    }, {}) as T
  } else {
    // We have some edge cases, like boolean values. Here we simply accept graphData
    return graphData
  }
}

// Takes a graph's data, and returns all subgraphs within the graph.
//
// The method also returns all the keys associated with the subgraphs. This may
// be array indices or object keys
export function getSubgraphs<T>(
  graph: T,
  ignoreSubGraphs?: string[]
): [number | string, GraphType<T>][] {
  const overloadedIgnoreSubGraphs = ignoreSubGraphs || []
  if (isObject(graph)) {
    return Object.entries(graph).filter(
      ([_, graph]) => isGraph(graph) && !overloadedIgnoreSubGraphs.includes(graph.id)
    )
  } else if (isArray(graph)) {
    return graph
      .filter(graph => isGraph(graph) && !overloadedIgnoreSubGraphs.includes(graph.id))
      .map((graph, i) => [i, graph])
  } else {
    return []
  }
}

/**
 * Creates a new traph state container.
 *
 * @param initialGraph Initial data
 * @param statePopulator An initial hook to populate used to populate the state.
 */
export default function traph<T>(
  initialGraph: {
    [P in keyof T]: T[P] extends (...args: any[]) => any
      ? (this: BoundGraphFunctionType<T>, ...args: Parameters<T[P]>) => void
      : T[P]
  },
  statePopulator?: (initialData: any) => any
): GraphType<T> {
  const Context = React.createContext<GraphContextType<T> | null>(null)

  const useHook = statePopulator || useDefaultStatePopulator
  const initialGraphData: RecursiveGraphData<T> = resolveSubGraphsData(initialGraph)

  function Provider(props: ProviderProps<T>) {
    const prevProps = useRef<RecursiveGraphDataPartial<T> | undefined>(undefined)
    const [graphData, setGraphData] = useHook(initialGraphData)

    useEffect(() => {
      if (isEqual(prevProps.current, props.graphData)) return
      prevProps.current = props.graphData

      if (props.graphData) setGraphData(mergeGraphData(graphData, props.graphData))
      // eslint-disable-next-line
    }, [props])

    // Iterate all children, and find the ones that are graphs.
    // We will automatically create providers for them as well, and compose
    // their providers.
    const subGraphs = getSubgraphs(initialGraph, props.ignoreSubGraphs)
    const subGraphIds = subGraphs.map(([_, graph]) => graph.id)

    // This little piece of magic takes all the returned providers, and
    // folds (reduces) them into each other to create a hierarchy.
    //
    // Note that the updater function actually just updates the
    const Providers = [<Context.Provider value={[initialGraph as T, graphData, setGraphData]} />]
      .concat(
        subGraphs.map(([key, subGraph]) => {
          const overridenGraphData = graphData[key]
          return (
            <subGraph.Provider
              graphData={overridenGraphData}
              ignoreSubGraphs={props.deduplicateProviders ? subGraphIds : []}
              deduplicateProviders={props.deduplicateProviders}
              children={null}
            />
          )
        })
      )
      .reduceRight((children, parent, i) => {
        return React.cloneElement(parent, {
          children
        })
        // The fragment is a workaround. See https://github.com/DefinitelyTyped/DefinitelyTyped/issues/18051
      }, <>{props.children}</>)

    return Providers
  }

  Provider.defaultProps = {
    deduplicateProviders: true
  }

  function useGraph(): UseGraphReturnValue<T> {
    const graphContext = useContext(Context)

    if (graphContext === null) {
      throw new Error('useGraph must be inside a provider of the store being called.')
    }

    const [graph, graphData, setGraph] = graphContext

    // We don't necessarily want to call setGraph directly. We will also
    // offer this function, which merges the functionality.
    const updateGraph: UpdateGraphFunctionType<T> = subGraph => {
      if (isFunction(subGraph)) {
        setGraph(subGraph)
      } else {
        setGraph(mergeGraphData(graphData, subGraph))
      }
    }

    // Inject graphData, then resolve substate
    const injectedGraph = resolveSubgraphs(mergeGraphData(graph, graphData))

    // Rebind functions
    const finalGraph = rebindGraphFunctions(injectedGraph, updateGraph, setGraph)

    return [finalGraph as RecursiveGraphData<T>, updateGraph, setGraph]
  }

  return {
    id: uniqueId('traph'),
    Provider,
    useGraph,
    Context,
    initialGraph: initialGraph as T,
    __isGraph: true
  }
}
