import React, { useContext, useState, ReactNode, Provider } from 'react'
import isString from 'lodash/isString'
import isObject from 'lodash/isObject'
import invariant from 'invariant'
import merge from 'lodash/merge'
import get from 'lodash/get'
import set from 'lodash/set'
import isFunction from 'lodash/isFunction'
import { 
  GraphValueInputType, 
  GraphContextType, 
  GraphType, 
  ProviderProps,
  UseGraphReturnValue
} from './types'

function isGraph(graph: GraphType): graph is GraphType{
  return graph.__isGraph
}

function useDefaultStatePopulator(values: any){
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
function rebindFunction(
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
function rebindGraphFunctions(
  graph: Record<string, any>, 
  updateGraph: (partialGraph: object) => void, 
  setGraph: (newGraph: object) => void
){
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
function resolveSubgraphs(
  graph: Record<string, any>, 
  path = null
){
  return Object.keys(graph).reduce((acc: Record<string, any>, key: string) => {
    const val = graph[key]
    if (val.__isGraph){
      if (path){
        acc[key] = val.useGraph(path)
      } else {
        acc[key] = val.useGraph()
      }
    } else {
      acc[key] = val
    }
    return acc
  }, {})
}

/**
 * Creates a new graph state container
 *  
 * @param values Initial data
 * @param statePopulator An initial hook to populate used to populate the state. 
 */
export default function graph(
  value: GraphValueInputType, 
  statePopulator?: (values: any) => any
): GraphType{
  const Context = React.createContext<GraphContextType | null>(null)

  const useHook = statePopulator || useDefaultStatePopulator

  function Provider(props: ProviderProps){
    const valueToUse = props.value ? props.value : value
    const [graph, setGraph] = useHook(valueToUse)

    // Iterate all children, and find the ones that are graphs.
    // We will automatically create providers for them as well, and compose
    // their providers.
    const subGraphs = Object.values(value)
      .filter(isGraph)

    // This little piece of magic takes all the returned providers, and 
    // folds (reduces) them into each other to create a hierarchy
    const Providers = [<Context.Provider value={[graph, setGraph]} />]
      .concat(subGraphs.map(graph => <graph.Provider value={graph.value} children={null} />))
      .reduceRight((children, parent, i) => {
        return React.cloneElement(parent, {
          children
        })
      // The fragment is a workaround. See https://github.com/DefinitelyTyped/DefinitelyTyped/issues/18051
      }, <>{props.children}</>)

    return Providers
  }

  function useGraph(...args: string[]): UseGraphReturnValue {
    const graphContext = useContext(Context)

    if (graphContext === null) {
      throw new Error("useGraph must be inside a provider of the store being called.")
    }

    const [graph, setGraph] = graphContext

    // We don't necessarily want to call setGraph directly. We will also
    // offer this function, which merges the functionality.
    function updateGraph(subGraph: any){
      setGraph({...merge(graph, subGraph)})
    }

    if (args.length === 0){
      // We make sure we bind all functions in the graph before returning it
      const graphWithBoundFunctions = rebindGraphFunctions(graph, updateGraph, setGraph)

      // Resolve substate
      const finalGraph = resolveSubgraphs(graphWithBoundFunctions)

      return [finalGraph, updateGraph, setGraph]
    } else {
      const values = args.map(arg => {
        invariant(isString(arg), "Arguments to useGraph must be string.")

        const pathSplit = arg.split(".")
        const propertyOnThisLevel = pathSplit[0]

        if (!graph.hasOwnProperty(propertyOnThisLevel)){
          return [null, (newValue: any) => updateGraph(newValue), setGraph]
        }

        let property = graph[propertyOnThisLevel]
        // If the property is a graph, we recursively call the useGraph hook
        if (property.__isGraph){
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

          // If the property is a function, we bind 'this' of the property with
          // the graph, updateGraph and setGraph attributes
          if (isFunction(property)){
            property = rebindFunction(property, graph, updateGraph, setGraph)
          }

          return [
            property, 
            (newValue: any) => {
              const updatedGraph = set(graph, pathSplit, newValue)
              setGraph({
                ...updatedGraph 
              })
            },
            setGraph
          ]
        }

        // If the property is a function, we bind 'this' of the property with
        // the graph, updateGraph and setGraph attributes
        if (isFunction(property)){
          property = rebindFunction(property, graph, updateGraph, setGraph)
        }

        return [property, (newValue: any) => updateGraph({[arg]: newValue}), setGraph]
      })
      if (values.length === 1) return values[0]
      else return values
    }
  }

  return {
    Provider,
    useGraph,
    Context,
    value: value,
    __isGraph: true
  }
}
