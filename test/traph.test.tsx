import React from 'react'
import graph from '../src/traph'

import { render, fireEvent, waitForElement } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'


/**
 * Dummy test
 */
describe("graph", () => {

  it("Constructs a data graph successfully", () => {
    graph({
      key: "value",
      user: {
        firstName: "Tormod",
        lastName: "Haugland"
      }
    })
  })

  it("Constructs a data graph with nested graphs successfully", () => {
    graph({
      key: "value",
      user: {
        username: "Name"
      },
      sub: graph({
        whatIsThis: "Cool!"
      })
    })
  })
  
  it("makes a single data graph accessible using the useGraph hook", () => {
    const dataGraph = graph({
      user: {
        firstName: "Tormod",
        lastName: "Haugland" 
      }
    })

    function Component(){
      const [firstName] = dataGraph.useGraph("user.firstName")

      return (
        <div>
          {firstName}
        </div>
      )
    }

    function OtherComponent(){
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

    getByText("Tormod")
    getByText("Tormod - Haugland")
  })

  it("allows for fetching multiple subtrees of the graph simultaneously", () => {
    const dataGraph = graph({
      user: {
        firstName: "Tormod",
        lastName: "Haugland" 
      }
    })

    function Component(){
      const [
        [firstName],
        [lastName]
      ] = dataGraph.useGraph("user.firstName", "user.lastName")

      return (
        <div>
          {firstName} - {lastName}
        </div>
      )
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
      </dataGraph.Provider>
    )

    getByText("Tormod - Haugland")
  })

  it("updates the current context state when set is called", () => {
    const dataGraph = graph({
      user: {
        firstName: "Tormod",
        lastName: "Haugland" 
      }
    })

    function Component(){
      const [firstName, setFirstName] = dataGraph.useGraph("user.firstName")

      return (
        <div onClick={() => setFirstName("Thomas")}>
          {firstName}
        </div>
      )
    }

    function OtherComponent(){
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

    const node = getByText("Tormod")
    fireEvent.click(node)

    getByText("Thomas")
    getByText("Thomas - Haugland")
  })

  it("resolves nested graph context values, and enables updates", () => {
    const dataGraph = graph({
      user: graph({
        firstName: "Tormod",
        lastName: "Haugland",
        house: graph({
          address: "Storgata 40",
          postalCode: "0182",
          postalPlace: "Oslo"
        })
      })
    })

    function Component(){
      const [houseAddress, setHouseAddress] = dataGraph.useGraph("user.house.address")

      return (
        <div onClick={() => setHouseAddress("New address")}>
          {houseAddress}
        </div>
      )
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
      </dataGraph.Provider>
    )

    const node = getByText("Storgata 40")

    fireEvent.click(node)
    getByText("New address")
  })

  it("allows for member functions of a graph to call updateGraph with new data", () => {
    const dataGraph = graph({
      user: graph({
        firstName: "Tormod",
        lastName: "Haugland",
        likes: 5,
        addLike(){
          this.updateGraph({
            likes: this.likes + 1
          })
        }
      })
    })

    function Component(){
      const [user] = dataGraph.useGraph("user")

      return (
        <div onClick={() => user.addLike()}>
          User likes: {user.likes}
        </div>
      )
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
      </dataGraph.Provider>
    )

    const node = getByText("User likes: 5")
    fireEvent.click(node)
    getByText("User likes: 6")
  })

  it("allows having different contexts with differing values for a graph", () => {
    const subGraph = graph({
      subKey: "subInitialValue"
    })

    const dataGraph = graph({
      key: "initialValue",
      subGraph  
    })

    function Component(){
      const [subKey, setSubkey] = dataGraph.useGraph("subGraph.subKey")

      return (
        <div onClick={() => setSubkey("Updated subkey")}>
          {subKey}
        </div>
      )
    }

    const { getByText } = render(
      <dataGraph.Provider>
        <Component />
        <subGraph.Provider value={{subKey: "override"}}>
          <Component />
        </subGraph.Provider>
      </dataGraph.Provider>
    )

    getByText("subInitialValue")
    const overrideNode = getByText("override")
    fireEvent.click(overrideNode)
    // Top level node stays the same
    getByText("subInitialValue")
    // New node is different
    getByText("Updated subkey")
    
  })
})
