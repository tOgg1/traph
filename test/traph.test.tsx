import React, { useContext } from 'react'
import traph, { mergeGraphData } from '../src/traph'

import {
  render,
  fireEvent,
  wait,
  getByLabelText,
  waitForElementToBeRemoved
} from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'
import { GraphType } from '../src/types'
import { open } from 'inspector'

describe('graph basic usage', () => {
  it('Constructs a data graph successfully', () => {
    traph({
      key: 'value',
      user: {
        firstName: 'Tormod',
        lastName: 'Haugland'
      }
    })
  })

  it('Constructs a data graph with nested graphs successfully', () => {
    traph({
      key: 'value',
      user: {
        username: 'Name'
      },
      sub: traph({
        whatIsThis: 'Cool!'
      })
    })
  })

  it('Accepts arrays as data', () => {
    traph([2, 3, 4, traph({ key: 'value' })])
  })

  it('Accepts scalars as data', () => {
    traph(2)
    traph(2.45)
    traph('Hello')
    traph(undefined)
    traph(null)
  })

  it('Accepts functions as data', () => {
    function handleSomething() {
      console.log('Hello')
    }

    traph(handleSomething)
  })
})

describe('graph hook usage', () => {
  it('makes a single data graph accessible using the useGraph hook', () => {
    const dataGraph = traph({
      user: {
        firstName: 'Tormod',
        lastName: 'Haugland'
      }
    })

    function Component() {
      const [firstName] = dataGraph.useGraph('user.firstName')

      return <div>{firstName}</div>
    }

    function OtherComponent() {
      const [graph] = dataGraph.useGraph()

      return (
        <div>
          {graph.user.firstName} - {graph.user.lastName}
        </div>
      )
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
        <OtherComponent />
      </dataGraph.Provider>
    )

    getByText('Tormod')
    getByText('Tormod - Haugland')
  })

  it('updates the current context state when set is called', () => {
    const dataGraph = traph({
      user: {
        firstName: 'Tormod',
        lastName: 'Haugland'
      }
    })

    function Component() {
      const [firstName, setFirstName] = dataGraph.useGraph('user.firstName')

      return <div onClick={() => setFirstName('Thomas')}>{firstName}</div>
    }

    function OtherComponent() {
      const [graph] = dataGraph.useGraph()

      return (
        <div>
          {graph.user.firstName} - {graph.user.lastName}
        </div>
      )
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
        <OtherComponent />
      </dataGraph.Provider>
    )

    const node = getByText('Tormod')
    fireEvent.click(node)

    getByText('Thomas')
    getByText('Thomas - Haugland')
  })

  it('allows updating with scalar values', () => {
    const Store = traph(true)

    function Component() {
      const [areWeLive, setAreWeLive] = Store.useGraph()

      return (
        <div onClick={() => setAreWeLive(!areWeLive)}>
          {areWeLive ? 'We are live' : 'We are not live'}
        </div>
      )
    }

    const { getByText } = render(
      <Store.Provider>
        <Component />
      </Store.Provider>
    )

    const element = getByText('We are live')
    fireEvent.click(element)
    getByText('We are not live')
  })

  it('allows updating with arrays', () => {
    const Store = traph([1, 2, 3])

    function Component() {
      const [data, setData] = Store.useGraph()

      return <div onClick={() => setData([4, 5, 6])}>{data.join(',')}</div>
    }

    const { getByText } = render(
      <Store.Provider>
        <Component />
      </Store.Provider>
    )

    const element = getByText('1,2,3')
    fireEvent.click(element)
    getByText('4,5,6')
  })

  it('allows updating with nested arrays', () => {
    const Store = traph({
      arrayData: [
        {
          nested: 'value'
        }
      ]
    })

    function Component() {
      const [data, setData] = Store.useGraph('arrayData')

      return (
        <div onClick={() => setData(data.concat({ nested: 'anothervalue' }))}>
          {data.map((value: { nested: string }) => value.nested).join(',')}
        </div>
      )
    }

    const { getByText } = render(
      <Store.Provider>
        <Component />
      </Store.Provider>
    )

    const element = getByText('value')
    fireEvent.click(element)
    expect(getByText('value,anothervalue')).toBeInTheDocument()
  })
})

describe('advanced usages', () => {
  it('resolves nested graph context values, and enables updates', () => {
    const dataGraph = traph({
      user: traph({
        firstName: 'Tormod',
        lastName: 'Haugland',
        house: traph({
          address: 'Storgata 40',
          postalCode: '0182',
          postalPlace: 'Oslo'
        })
      })
    })

    function Component() {
      const [houseAddress, setHouseAddress] = dataGraph.useGraph('user.house.address')

      return <div onClick={() => setHouseAddress('New address')}>{houseAddress}</div>
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
      </dataGraph.Provider>
    )

    const node = getByText('Storgata 40')

    fireEvent.click(node)
    getByText('New address')
  })

  it('allows for member functions of a graph to call updateGraph with new data', () => {
    const dataGraph = traph({
      user: traph({
        firstName: 'Tormod',
        lastName: 'Haugland',
        likes: 5,
        addLike() {
          this.updateGraph({
            likes: this.likes + 1
          })
        }
      })
    })

    function Component() {
      const [user] = dataGraph.useGraph('user')

      return <div onClick={() => user.addLike()}>User likes: {user.likes}</div>
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
      </dataGraph.Provider>
    )

    const node = getByText('User likes: 5')
    fireEvent.click(node)
    getByText('User likes: 6')
  })

  it('allows for async member functions of a graph to call updateGraph with new data', async () => {
    function sleep(ms: number) {
      return new Promise(resolve => setTimeout(resolve, ms))
    }

    const Graph = traph({
      toasts: traph({
        nextId: 0,
        items: [],
        async addToast({ type, message }: { type: string; message: string }) {
          const nextId = this.nextId + 1
          this.updateGraph({
            nextId: nextId,
            items: this.items.concat({
              id: nextId,
              type,
              message
            })
          })
          await sleep(1000)
          this.updateGraph((data: { items: [{ id: number }] }) => ({
            ...data,
            items: data.items.filter((item: { id: number }) => item.id !== nextId)
          }))
        }
      })
    })

    function Component() {
      const [toasts] = Graph.useGraph('toasts')

      return (
        <div
          aria-label="toast-container"
          onClick={() => {
            toasts.addToast({ type: 'success', message: 'New message' })
          }}
        >
          {toasts.items.map((toast: { id: number; type: string; message: string }) => (
            <div key={toast.id} aria-label={'Message-' + toast.id}>
              {toast.message}
            </div>
          ))}
        </div>
      )
    }

    const { getByText } = render(
      <Graph.Provider>
        <Component />
      </Graph.Provider>
    )

    let node = getByLabelText(document.body, 'toast-container')
    fireEvent.click(node)
    expect(getByLabelText(document.body, 'Message-1')).toBeInTheDocument()
    await waitForElementToBeRemoved(() => getByLabelText(document.body, 'Message-1'), {
      container: document.body
    })

    // Try adding two toasts. Both should appear and disappear in the right order
    // Refetch
    node = getByLabelText(document.body, 'toast-container')
    fireEvent.click(node)
    expect(getByLabelText(document.body, 'Message-2')).toBeInTheDocument()
    await sleep(100)
    fireEvent.click(node)
    expect(getByLabelText(document.body, 'Message-3')).toBeInTheDocument()
    await waitForElementToBeRemoved(() => getByLabelText(document.body, 'Message-2'), {
      container: document.body
    })

    expect(getByLabelText(document.body, 'Message-3')).toBeInTheDocument()
    await waitForElementToBeRemoved(() => getByLabelText(document.body, 'Message-3'), {
      container: document.body
    })
  })

  it('allows having different contexts with differing values for a graph', () => {
    const subGraph = traph({
      subKey: 'subInitialValue'
    })

    const dataGraph = traph({
      key: 'initialValue',
      subGraph
    })

    function Component() {
      const [subKey, setSubkey] = dataGraph.useGraph('subGraph.subKey')

      return <div onClick={() => setSubkey('Updated subkey')}>{subKey}</div>
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
        <subGraph.Provider graphData={{ subKey: 'override' }}>
          <Component />
        </subGraph.Provider>
      </dataGraph.Provider>
    )

    getByText('subInitialValue')
    const overrideNode = getByText('override')
    fireEvent.click(overrideNode)
    // Top level node stays the same
    expect(getByText('subInitialValue')).toBeInTheDocument()
    // New node is different
    getByText('Updated subkey')
  })

  it('altering slices of the tree spanning multiple graphs updates the data correctly', () => {
    const bottomLevel = traph({
      deep: 0
    })

    const midLevel = traph({
      middle: 10,
      bottom: bottomLevel
    })

    const topLevel = traph({
      top: 20,
      middle: midLevel
    })

    function Component() {
      const [graph, setGraph] = topLevel.useGraph()

      return (
        <div
          onClick={() =>
            setGraph({
              top: graph.top + 1,
              middle: {
                middle: graph.middle.middle + 1,
                bottom: {
                  deep: graph.middle.bottom.deep + 1
                }
              }
            })
          }
        >
          {graph.top} - {graph.middle.middle} - {graph.middle.bottom.deep}
        </div>
      )
    }

    function ComponentUsingMidLevel() {
      const [midGraph, setMidGraph] = midLevel.useGraph()
      return (
        <div
          onClick={e => {
            setMidGraph({
              middle: midGraph.middle + 1,
              bottom: {
                deep: midGraph.bottom.deep + 1
              }
            })
            e.stopPropagation()
          }}
        >
          {midGraph.middle} - {midGraph.bottom.deep}
        </div>
      )
    }

    function ComponentUsingBottomLevel() {
      const [bottomGraph, setBottomGraph] = bottomLevel.useGraph()
      return (
        <div
          onClick={e => {
            setBottomGraph({ deep: bottomGraph.deep + 1 })
            e.stopPropagation()
          }}
        >
          {bottomGraph.deep}
        </div>
      )
    }

    const { getByText } = render(
      <topLevel.Provider>
        <Component />
        <ComponentUsingBottomLevel />
        <ComponentUsingMidLevel />
      </topLevel.Provider>
    )

    const bottom = getByText('0')
    const mid = getByText('10 - 0')
    const top = getByText('20 - 10 - 0')

    fireEvent.click(bottom)

    getByText('1')
    getByText('10 - 1')
    getByText('20 - 10 - 1')

    fireEvent.click(mid)

    getByText('2')
    getByText('11 - 2')
    getByText('20 - 11 - 2')

    fireEvent.click(top)

    getByText('3')
    getByText('12 - 3')
    getByText('21 - 12 - 3')
  })

  it('deleting slices of the tree spanning multiple graphs updates the data correctly', () => {
    // It should be possible to delete subgraphs from a top-level graph context
    const Graph = traph({
      top: 'value',
      subgraph: traph({
        bottom: 'value2'
      })
    })

    function Component() {
      const [graph, setGraph] = Graph.useGraph()

      return (
        <div
          onClick={() =>
            setGraph({
              subgraph: null
            })
          }
        >
          {graph.subgraph ? 'Subgraph exists' : 'Subgraph does not exist'}
        </div>
      )
    }

    const { getByText } = render(
      <Graph.Provider>
        <Component />
      </Graph.Provider>
    )

    const element = getByText('Subgraph exists')

    fireEvent.click(element)

    getByText('Subgraph does not exist')
  })

  it('subgraph mounted at multiple locations is updated at all locations', () => {
    type Person = {
      name: string
      age: number
    }

    const Mark = traph({
      name: 'Mark',
      age: 24
    })

    const Susy = traph({
      name: 'Susy',
      age: 25
    })

    const Mona = traph({
      name: 'Mona',
      age: 55,
      children: [Mark]
    })

    const Paul = traph({
      name: 'Paul',
      age: 56,
      children: [Mark, Susy]
    })

    const People = traph({
      paul: Paul,
      mona: Mona,
      susy: Susy,
      mark: Mark
    })

    function PaulComponent() {
      // Alternatively Paul.useGraph()
      const [paul, setPaul] = People.useGraph('paul')

      return (
        <div>
          Paul is the father of: {paul.children.map((child: Person) => child.name).join(', ')}
        </div>
      )
    }

    function MonaComponent() {
      // Alternatively Mona.useGraph()
      const [mona, setMona] = People.useGraph('mona')

      const context = useContext(Mark.Context)

      return (
        <div>
          Mona is the mother of: {mona.children.map((child: Person) => child.name).join(', ')}
        </div>
      )
    }

    function MarkComponent() {
      // Alternatively Mark.useGraph()
      const [mark, setMark] = People.useGraph('mark')

      return <div onClick={() => setMark({ name: 'John' })}>Click me to change Mark's name!</div>
    }

    const { getByText } = render(
      <People.Provider>
        <PaulComponent />
        <MarkComponent />
        <MonaComponent />
      </People.Provider>
    )

    const markElement = getByText("Click me to change Mark's name!")

    getByText('Paul is the father of: Mark, Susy')
    getByText('Mona is the mother of: Mark')

    fireEvent.click(markElement)

    getByText('Paul is the father of: John, Susy')
    getByText('Mona is the mother of: John')
  })

  it('should not overwrite subgraphs when "local data" is altered', () => {
    type Item = {
      name: string
      price: number
    }

    const SubStoreOne = traph({
      items: [],
      addItem(name: string, price: number) {
        this.updateGraph({
          items: this.items.concat({ name, price })
        })
      }
    })
    const Store = traph({
      cartOpen: false,
      subStoreOne: SubStoreOne,
      subStoreTwo: traph({
        ticketsBought: 0,
        buyTicket() {
          this.updateGraph({ ticketsBought: ++this.ticketsBought })
        }
      })
    })

    function StoreComponent() {
      const [cartOpen, setCartOpen] = Store.useGraph('cartOpen')
      return (
        <div>
          <div onClick={() => setCartOpen(!cartOpen)}>Open cart</div>
          {cartOpen && <div>Cart is here</div>}
        </div>
      )
    }

    function SubStoreOneView() {
      const [storeOne] = SubStoreOne.useGraph()
      return (
        <div>
          <div onClick={() => storeOne.addItem('newItem', 5)}>Add another item!</div>
          <div>
            {storeOne.items.map((item: Item) => (
              <div key={item.name}>
                {item.name}: {item.price},-
              </div>
            ))}
          </div>
        </div>
      )
    }

    const { getByText } = render(
      <Store.Provider>
        <StoreComponent />
        <SubStoreOneView />
      </Store.Provider>
    )

    const addItem = getByText('Add another item!')
    fireEvent.click(addItem)

    getByText('newItem: 5,-')

    const openCartItem = getByText('Open cart')
    fireEvent.click(openCartItem)

    getByText('Cart is here')
    getByText('newItem: 5,-')
  })
})

describe('mergeGraphData', () => {
  it('should accept the new value when given scalars', () => {
    expect(mergeGraphData(1, 2)).toEqual(2)
    expect(mergeGraphData('string', 'otherString')).toEqual('otherString')
    expect(mergeGraphData('string', null)).toEqual(null)
    expect(mergeGraphData({}, null)).toEqual(null)
    expect(mergeGraphData(undefined, null)).toEqual(null)
    expect(mergeGraphData(null, undefined)).toEqual(undefined)
  })
  it('should recursively accept new values when given plain objects', () => {
    expect(mergeGraphData({ a: 2, c: 5 }, { a: 3, b: 4 })).toEqual({ a: 3, b: 4, c: 5 })
  })
  it('should recursively accept new values when given arrays', () => {
    expect(mergeGraphData([2, 3, 'string'], [2, 3, 4])).toEqual([2, 3, 4])
  })
  it('should take old values when given graph types', () => {
    const graph = traph({
      key: 'value'
    })
    expect(mergeGraphData(graph, { sub: { key: 'value' } })).toEqual(graph)
  })
  it('should recursively take new non-graph values, and old graph-values', () => {
    const subGraph = traph({
      key: 'value'
    })
    const graph = {
      a: 2,
      b: subGraph,
      c: {
        d: 5,
        e: 6
      }
    }
    const newGraph = {
      a: 9,
      b: {
        key: 'value'
      },
      c: {
        d: 10
      }
    }

    expect(mergeGraphData(graph, newGraph)).toEqual({
      a: 9,
      b: subGraph,
      c: {
        d: 10,
        e: 6
      }
    })
  })
  it('should recursively take old values when there exists deep graphs', () => {
    const subGraph = traph({
      key: 'value'
    })
    const graph = {
      a: 2,
      b: {
        f: subGraph
      },
      c: {
        d: 5,
        e: 6
      }
    }
    const newGraph = {
      a: 9,
      b: {
        f: {
          g: 'some updated value deep down'
        }
      },
      c: {
        d: 10
      }
    }
    expect(mergeGraphData(graph, newGraph)).toEqual({
      a: 9,
      b: {
        f: subGraph
      },
      c: {
        d: 10,
        e: 6
      }
    })
  })
  it('should recursively take new values when there exists deep arrays', () => {
    // Here we also test deeply nested arrays
    const graph = {
      a: 2,
      b: 'string',
      c: {
        d: [2, 3, { a: 2 }, 5]
      }
    }
    const newGraph = {
      a: 2,
      b: 'string',
      c: {
        d: [3, 3, { c: 3 }, 6]
      }
    }
    expect(mergeGraphData(graph, newGraph)).toEqual({
      a: 2,
      b: 'string',
      c: {
        d: [3, 3, { a: 2, c: 3 }, 6]
      }
    })
  })
  it('should recursively take old graphs when there exists deep arrays', () => {
    // Here we also test deeply nested arrays
    // Here we also test deeply nested arrays
    const subGraph = traph({
      a: 3
    })

    const graph = {
      a: 2,
      b: 'string',
      c: {
        d: [2, 3, subGraph, 5]
      }
    }
    const newGraph = {
      a: 2,
      b: 'string',
      c: {
        d: [3, 3, { c: 3 }, 6]
      }
    }

    expect(mergeGraphData(graph, newGraph)).toEqual({
      a: 2,
      b: 'string',
      c: {
        d: [3, 3, subGraph, 6]
      }
    })
  })
})
