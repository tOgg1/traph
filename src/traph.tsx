import React, { useContext, useState, useEffect } from 'react'
import isString from 'lodash/isString'
import isObject from 'lodash/isObject'
import isFunction from 'lodash/isFunction'
import isPlainObject from 'lodash/isPlainObject'
import isArray from 'lodash/isArray'
import isNumber from 'lodash/isNumber'
import union from 'lodash/union'
import uniqueId from 'lodash/uniqueId'
import get from 'lodash/get'
import set from 'lodash/set'
import { 
  GraphContextType, 
  GraphType, 
  ProviderProps,
  UseGraphReturnValue
} from './types'

export function isGraph(graph: GraphType): graph is GraphType{
  return graph && graph.__isGraph
}

export function useDefaultStatePopulator(values: any){
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
export function rebindFunction(
  func: (args?: any) => any, 
  graph: object, 
  updateGraph: (partialGraph: object) => void, 
  setGraph: (newGraph: object) => void
){
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
export function rebindGraphFunctions(
  graph: any,
  updateGraph: (partialGraph: object) => void, 
  setGraph: (newGraph: object) => void
){
  if (!isPlainObject(graph)){
    return graph
  }
  return Object.keys(graph).reduce((acc: Record<string, any>, key: string) => {
    const val = graph[key]
    if (!isFunction(val)){
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
export function resolveSubgraphs(
  graph: any
): any{
  if (isGraph(graph)){
    return null
  } else if (isPlainObject(graph)){
    return Object.entries(graph).reduce((acc: Record<string, any>, [key, value]: [string, any]) => {

      if (isGraph(value)){
        acc[key] = value.useGraph()[0]
      } else if(isObject(value)){
        // is Object here means that it should be iterated over
        acc[key] = resolveSubgraphs(value)
      } else {
        acc[key] = value
      }
      return acc
    }, {})
  } else if(isArray(graph)){
    const _new = graph.map(data => {
      if (isGraph(data)){
        return data.useGraph()[0]
      } else if(isObject(data)){
        // is Object here means that it should be iterated over
        return resolveSubgraphs(data)
      } 
      return data
    })
    return _new
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
export function resolveSubGraphsData(
  graphData: any
): any{
  if (isGraph(graphData)){
    return resolveSubGraphsData(graphData.initialGraph)
  } else if (isPlainObject(graphData)){
    return Object.entries(graphData).reduce((acc: Record<string, any>, [key, value]: [string, any]) => {
      if (isGraph(value)){
        acc[key] = resolveSubGraphsData(value.initialGraph)
      } else if(isObject(value)){
        // is Object here means that it should be iterated over
        acc[key] = resolveSubGraphsData(value)
      } else {
        acc[key] = value
      }
      return acc
    }, {})
  } else if(isArray(graphData)){
    return graphData.map(data => {
      if (isGraph(data)){
        return resolveSubGraphsData(data)
      } 
      return data
    })
  } else {
    return graphData
  }
}

export function mergeGraphData(
  graph: any,
  graphData: any,
): any{
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

  if (graphData === null || graphData === undefined || isString(graphData) || isNumber(graphData)){
    return graphData
  } else if(isGraph(graph)){
    return graph
  } else if(isArray(graphData)){
    // For mismatching types, we assume that the end-users knows what they are doing, and
    // has overwritten nested graph-data.
    if (!isArray(graph)){
      return graphData
    }

    const longestArray = Math.max(graphData.length, graph.length)
    const newArray = []

    for(let i = 0; i < longestArray; ++i){
      const graphVal = graph[i]
      const graphDataVal = graphData[i]

      if (graphVal === undefined) return graphDataVal
      if (graphDataVal === undefined) return graphVal

      newArray.push(mergeGraphData(graphVal, graphDataVal))
    }
    
    return newArray
  } else if(isPlainObject(graphData)){
    // For mismatching types, we assume that the end-users knows what they are doing, and
    // has overwritten nested graph-data.
    if (!isPlainObject(graph)) return graphData

    const graphKeys = Object.keys(graph)
    const graphDataKeys = Object.keys(graphData)
    const allKeys = union(graphKeys, graphDataKeys)

    return allKeys.reduce((newGraph: Record<string, any>, key) => {
      const graphVal = graph[key]
      const graphDataVal = graphData[key]

      if (graphVal === undefined){
        newGraph[key] = graphDataVal
      } else if (graphDataVal === undefined){
        newGraph[key] = graphVal
      } else {
        newGraph[key] = mergeGraphData(graphVal, graphDataVal)
      }
      return newGraph
    }, {})

  } else {
    // We have some edge cases, like boolean values. Here we simply accept graphData
    return graphData
  }
}

// Takes a graph's data, and returns all subgraphs within the graph.
//
// The method also returns all the keys associated with the subgraphs. This may
// be array indices or object keys 
export function getSubgraphs(
  graph: any, 
  ignoreSubGraphs?: string[]
): [number | string, GraphType][]{
  const overloadedIgnoreSubGraphs = ignoreSubGraphs || []
  if (isObject(graph)){
    return Object
      .entries(graph)
      .filter(([_, graph]) => isGraph(graph) && !overloadedIgnoreSubGraphs.includes(graph.id))
  } else if(isArray(graph)){
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
export default function traph(
  initialGraph: any, 
  statePopulator?: (values: any) => any
): GraphType{
  const Context = React.createContext<GraphContextType | null>(null)

  const useHook = statePopulator || useDefaultStatePopulator
  const initialGraphData = resolveSubGraphsData(initialGraph)

  function Provider(props: ProviderProps){

    const [graphData, setGraphData] = useHook(initialGraphData)

    useEffect(() => {
      if (props.graphData){
        setGraphData(mergeGraphData(
          graphData,
          props.graphData
        ))
      }
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
    const Providers = [<Context.Provider value={[initialGraph, graphData, setGraphData]} />]
      .concat(subGraphs.map(([key, subGraph]) => {
        const overridenGraphData = graphData[key]
        return (
          <subGraph.Provider 
            graphData={overridenGraphData} 
            ignoreSubGraphs={props.deduplicateProviders ? subGraphIds : []}
            deduplicateProviders={props.deduplicateProviders}
            children={null}
          />
        )
      }))
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

  function useGraph(selector?: string): UseGraphReturnValue {
    const graphContext = useContext(Context)

    if (graphContext === null) {
      throw new Error("useGraph must be inside a provider of the store being called.")
    }

    const [graph, graphData, setGraph] = graphContext

    // We don't necessarily want to call setGraph directly. We will also
    // offer this function, which merges the functionality.
    function updateGraph(subGraph: any){
      setGraph(mergeGraphData(graphData, subGraph))
    }


    if (!selector){
      // Inject graphData, then resolve substate
      const injectedGraph = resolveSubgraphs(
        mergeGraphData(graph, graphData)
      )

      // Rebind functions
      const finalGraph = rebindGraphFunctions(
        injectedGraph, updateGraph, setGraph
      )

      return [finalGraph, updateGraph, setGraph]
    } else {
      const pathSplit = selector.split(".")
      const propertyOnThisLevel = pathSplit[0]

      // Await binding functions and resolving subgraphs, as we might have to recurse here.
      // Do merge in graphData, however
      const finalGraph = mergeGraphData(graph, graphData)

      if (!finalGraph.hasOwnProperty(propertyOnThisLevel)){
        return [null, (newValue: any) => updateGraph(newValue), setGraph]
      }

      let property = finalGraph[propertyOnThisLevel]

      // If the property is a graph, we recursively call the useGraph hook
      if (isGraph(property)){
        // We supply the next part of the args chain if it exists
        if (pathSplit.length > 1){
          return property.useGraph(pathSplit.slice(1).join("."))
        } else {
          return property.useGraph()
        }
      } else if (pathSplit.length > 1){
        // If our selector is some sort of nested selector (and we are not dealing with a graph), we try to use
        // lodash.get on it. Note that we need to be slightly clever when updating
        // the state in this scenario, to ensure we only updated the picked value.
        // Fortunately, lodash supplies the main bulk of required cleverness with lodash.set.

        property = get(property, pathSplit.slice(1).join("."))

        return [
          property, 
          (newValue: any) => {
            const updatedGraph = set(finalGraph, pathSplit, newValue)
            setGraph({
              ...updatedGraph 
            })
          },
          setGraph
        ]
      }

      return [property, (newValue: any) => updateGraph({[selector]: newValue}), setGraph]
    }
  }

  return {
    id: uniqueId("traph"),
    Provider,
    useGraph,
    Context,
    initialGraph,
    __isGraph: true
  }
}
