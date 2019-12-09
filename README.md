# Traph
[![npm](https://img.shields.io/npm/v/react-traph)](https://www.npmjs.com/package/react-traph)
[![Travis](https://travis-ci.org/tOgg1/traph.svg?branch=develop)](https://travis-ci.org/tOgg1/traph)

## Installation

```
yarn add react-traph
```

## Example

```tsx
import React from 'react'
import traph from 'react-traph'
import ReactDOM from 'react-dom'

const Graph = traph({
  user: {
    firstName: "Tormod",
    lastName: "Haugland"
  },
  toasts: traph({
    items: [],
    addToast(message){
      this.updateGraph({
        items: this.items.concat({message})
      })
    }
  })
})

function Toast({message}){
  const [lastName, setLastName] = Graph.useGraph("user.lastName")
  return (
    <div onClick={() => setLastName(message)}>
      {message}
    </div>
  )
}


function ToastContainer(){
  const [user] = Graph.useGraph("user")
  const [toasts] = Graph.useGraph("toasts")

  return (
    <div onClick={() => toasts.addToast(user.firstName + ", " + user.lastName)}>
      Hey {user.firstName}! Click me!
      {toasts.items.map(toast => <Toast message={toast.message} />)}

    </div>
  )
}

function UserForm(){
  const [user, setUser] = Graph.useGraph("user")
  return ( 
    <form>
      <input value={user.firstName} onChange={e => setUser({firstName: e.target.value})} /> 
      <input value={user.lastName} onChange={e => setUser({lastName: e.target.value})} /> 
    </form>
  )
}

ReactDOM.render(
  <Graph.Provider>
    <UserForm />
    <ToastContainer />
  </Graph.Provider>
)
```

## User guide

### Creating and using a traph tree

The primary function of this library is `traph`. It creates a new store-like object we refer to as a graph (although it is technically a tree). The two primary fields exposed by a graph is the `Provider` React node and the `useGraph`-hook.

When `traph` is called, a new React Context used to contain all the data for the graph is created. All subgraphs are also recursively instantiated. 

Let's use traph to create a very simple TODO-app. First we create the graph:

```jsx
  // TodoGraph.js
  import traph from 'traph'

  const TodoGraph = traph({
    items: [],
    nextId: 0
  })

  export default TodoGraph
```

Then we create our components:

```jsx
import React, { useState } from 'react'

// Todo.jsx
function Todo({
  id,
  text,
  done,
  onClick
}){
  <Todo 
    className={done ? "done" : ""} 
    onClick={onClick}
  >
    {text}
  </Todo>
}

export default Todo

// Todos.jsx
function Todos(){
  // This fetches the entire graph-data, i.e.
  // { items: Array }
  const [todos, setTodos] = TodoGraph.useGraph()

  function handleClick(item){
    setTodos({
      items: todos.items.map(_item => {
        if (_item.id === item.id) {
          return {...item, done: !item.done}
        }
        return _item
      })
    })}
  }

  return (
    <ul>
      {todos.items.map(item => (
        <Todo 
          key={item.id} 
          onClick={handleClick}
        >
          {item.text}
        </Todo>
      ))}
    </ul>
  )
}

export default Todos
```

```jsx
// CreateTodoForm.jsx
function CreateTodoForm(){
  const [todos, setTodos] = TodoGraph.useGraph()
  const [todoText, setTodoText] = useState("")

  function handleSubmit(e){
    e.preventDefault();
    if (!todoText) return
    setTodos({
        items: items.concat({
        id: todos.nextId + 1,
        text: todoText,
        done: false
      }),
      nextId: todos.nextId + 1
    })
  }

  return ( 
    <form onSubmit={handleSubmit}>
      <input type="text" value={todoText} onChange={e => setTodoText(e.target.value)} /> 
      <button>Add new Todo</button>
    </form>
  )
}

export default CreateTodoForm
```

And finally we wrap the components in a provider and render it

```jsx
// index.jsx
import React from 'react'
import ReactDOM from 'react-dom'
import CreateTodoForm from './CreateTodoForm'
import Todos from './Todos'
import TodoGraph from './TodoGraph'

return ReactDOM.render(
  <TodoGraph.Provider>
    <CreateTodoForm />
    <Todos />
  </TodoGraph.Provider>
)
```

### Querying specific parts of the graph

In the example above, the `<Todos />`-component only really cares about the `items`-entry of the state. We can query this part of the graph specifically, by supplying an argument to the useGraph-function:

```jsx
// Todos.jsx
function Todos(){
  const [items, setItems] = TodoGraph.useGraph("items")

  function handleClick(item){
    setItems(todos.items.map(_item => {
      if (_item.id === item.id) {
        return {...item, done: !item.done}
      }
      return _item
    }))
  }

  return (
    <ul>
      {items.map(item => (
        <Todo 
          key={item.id} 
          onClick={handleClick}
        >
          {item.text}
        </Todo>
      ))}
    </ul>
  )
}
export default Todos

```

traph ensures that when setItems is called, the correct part of the graph is updated.

For more deeply nested structures, we can use a dot to separate what part to query. Internally, [lodash get](https://lodash.com/docs/4.17.15#get) is used here. Hence for a structure like 

```jsx
const Graph = traph({
  top: {
    middle: {
      bottom: [
        {name: "User 1"},
        {name: "User 2"},
      ]
    }
  }
})
```

We could now get the second user by executing

```jsx
const [user, setUser] = Graph.useGraph("top.middle.bottom[2]")
```

Updating the user with `setUser` will merge the new data into the graph as expected.


### Member functions

When calling `useGraph`, we automatically get a function to update the state we have just received. 

However, some people (yes, I'm looking at you) prefer to use member functions of their state to mutate `this`. To avoid having to implement an observer-observable pattern on all attributes of a state, traph rebinds all functions in a graph, and makes available an `updateGraph`-method on `this`:

```jsx
const Toasts = traph({
  nextToastId: 0,
  toasts: [],
  addToast({type, message}){
    this.updateGraph({
      toasts: this.toasts.concat({type, message})
    })
  }
})
```

Note also that all the graph's current values are injected into `this`.

The `updateGraph`-method is literally the same method as is returned when calling `Toasts.useGraph()`.

### Using non-objects as values

In the above examples, we have used objects as the initial value to traph. However, traph can store any data you wish to throw at it.

```jsx
const Users = traph([
  {name: "Mike"},
  {name: "James"},
])

const IsOffline = traph(false)

const MeasurementData = traph([1.3, 1.2, 1.15, 3.4, 3.2, 2.8])

const NumberOfUsersOnline = traph(123)

```

### Nested trees

#### Basic usage

One of the strengths of traph is the ability to nest graphs. Nested graphs can be used both independently and jointly.

Suppose we have:

```jsx
const SidebarGraph = traph({
  open: false,
  toggle(){
    this.updateGraph({open: !this.open})
  }
  set(open){
    this.updateGraph({open})
  }
})

const ToastGraph = traph({
  toasts: [],
  addToast({type, message}){
    this.updateGraph({
      toasts: this.toasts.concat({type, message})
    })
  }
})

const Graph = traph({
  someTopLevelValue: 42,
  toasts: ToastGraph,
  sidebar: SidebarGraph,
})
```

One of the advantages of nesting the graphs inside a top-level graph, is that the top-level Provider automatically will create the context-providers of the subgraphs:

```jsx
<Graph.Provider>
  {/* Graph.Provider renders ToastGraph.Provider and 
      SidebarGraph.Provider automatically */}
  <ComponentConsumingAllGraphData />
</Graph.Provider>
```

Within `<ComponentConsumingAllGraphData />`, we can query, for instance, the data in `ToastGraph` in two distinct ways:

```jsx
function ComponentConsumingAllGraphData(){
  const [toastGraph, setToastGraph] = ToastGraph.useGraph()
  // or
  const [toastGraph, setToastGraph] = Graph.useGraph("toasts")
  
  ...
}
```

These are, in this scenario, equivalent. However, they may return differing results if the top-level Graph store is altered in a way which [removes the toasts subgraph](#removing-subgraphs).


#### Querying into sub-graphs

We can query into subgraphs in the expected manner. Suppose we are given the [Graph above](#basic-usage).

```jsx
function Component(){
  // Will return the first element of the `toasts` property in the `toasts`-subgraph.
  const [firstToast, setFirstToast] = Graph.useGraph("toasts.toasts[0]")

  ...
}
```

#### Automatic propagation of updated subgraph values

Suppose we have the following Graph:

```jsx
const Graph = traph({
  top: traph({
    topValue: 103993/33102, 
    middle: traph({
      middleValue: 1337,
      bottom: traph({
        deepValue: 41
      })
    })
  })
})
```

and the following components:

```jsx
function ComponentUsingTop(){
  const [top, setTop] = Graph.useGraph("top")

  return (
    <div>
      {top.middle.bottom.deepValue}
    </div>
  )
}

function ComponentUsingMiddle(){
  const [middle, setMiddle] = Graph.useGraph("top.middle")

  return (
    <div>
      {middle.bottom.deepValue}
    </div>
  )
}

function ComponentUsingBottom(){
  const [bottom, setBottom] = Graph.useGraph("top.middle.bottom")

  return (
    <div onClick={() => setBottom({deepValue: bottom.deepValue + 1})}>
      {bottom.deepValue}
    </div>
  )
}
```

If the `<div>` in `<ComponentUsingBottom>` is clicked, all components receives the updated `deepValue` automatically. 

Any consumer of any graph above a graph being altered will also have its values updated.

#### Updating slices spanning multiple sub graphs

Expanding on the above example, we can wonder what happens if we update a slice of the entire graph from the consumer of the top graph. traph will in this scenario ensure that the
data is propagated down into the subgraphs:

```jsx
function ComponentUsingTop(){
  const [top, setTop] = Graph.useGraph("top")

  return (
    <div onClick={() => setTop({
      topValue: Math.PI,  // Should be more precise
      middle: {
        // middleValue is fine as is. Omitting it in the update object will simply let it
        // stay put
        bottom: {
          deepValue: top.middle.bottom.deepValue + 1
        }
      }
    })}>
      {top.middle.bottom.deepValue}
    </div>
  )
}

function ComponentUsingMiddle(){
  const [middle, setMiddle] = Graph.useGraph("top.middle")

  return (
    <div>
      {middle.bottom.deepValue}
    </div>
  )
}

function ComponentUsingBottom(){
  const [bottom, setBottom] = Graph.useGraph("top.middle.bottom")

  return (
    <div onClick={() => setBottom({deepValue: bottom.deepValue + 1})}>
      {bottom.deepValue}
    </div>
  )
}
```

As is expected, the Context in all the subgraphs are updated appropriately.

### Overriding contexts

As traph is powered by React Contexts at its core, it is possible to have different values
for a graph at different locations in the component hierarchy.

```jsx
const Graph = traph({
  message: "hello"
})

function Component(){
  const [message, setMessage] = Graph.useGraph("message")

  return (
    <div onClick={() => setMessage("updated")}>
      {message}
    </div>
  )
}

ReactDOM.render(
  <Graph.Provider>
    <Component />
    <Graph.Provider graphData={{message: "override"}}>
      <Component />
    </Graph.Provider>
  </Graph.Provider>
)
```

This would render two divs, the first with inner text "hello", and the second with inner text "override". Note that the `graphData` property overrides the Graph initial data.

If the second div is clicked, only the second `<Component>` has its value updated.

### Attaching graphs to multiple locations

While the Graph data-structure returned by traph is technically a tree, it exhibits one piece of graph-like cyclic behavior, and that is the possibility to attach a graph to multiple locations within a tree. 

```jsx
const UserOne = traph({
  name: "UserOne",
  life: 10
})

const UserTwo = traph({
  name: "UserOne",
  life: 10
})

const Users = traph([
  UserOne,
  UserTwo
])

const HouseOne = traph({
  inhabitant: UserOne,
  size: 500
})
const HouseTwo = traph({
  inhabitant: UserTwo,
  size: 600
})

const Houses = traph([HouseOne, HouseTwo])

const Game = traph({
  users: Users,
  houses: Houses
})
```

This is perfectly valid — altough rather strange — and is handled appropriately by traph. If one of the users is consumed in any manner, and altered; this change is propagated to all other graphs/subgraphs which uses the user.

```jsx

function UserList(){
  const [users] = Game.useGraph("users")

  return (
    <div>
      {users.map(user => <div>{user.name}</div>)}
    </div>
  )
}

function UserOneArea(){
  const [userOne, setUserOne] = Game.userGraph("users[0]")

  return (
    <div>
      <h2>First users area</h2>
      <span>Name: {userOne.name}</span>
      <span onClick={() => setUserOne({life: userOne.life - 1})}>Life: {userOne.life}</span>
    </div>
  )
}

function Houses(){
  const [houses] = Game.useGraph("houses")

  return (
    <div>
      {houses.map(house => (
        <div>
          <div>{house.name}</div>
          {house.users.map(user => (
            <div key={user.name}>
              {user.name} lives here and has {user.life} life left.
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

```

Clicking the life on the first users area will automatically update the UserOne graph's value in all the places where the graph is mounted.

### Removing subgraphs

The structure of a graph's data is partially immutable after creation. Specifically,
the initial structure is stored separately from the mutated data. When a graph's data is consumed using `useGraph`, this structure is used when resolving subgraph state. Hence,
you cannot really replace a subgraph with other data.

You can however disable the subgraph, by setting the corresponding key to `null`.

```jsx
const Graph = traph({
  top: "value",
  subgraph: traph({
    bottom: "value2"
  })
})

function Component(){
  const [graph, setGraph] = Graph.useGraph()

  return (
    <div onClick={() => setGraph({
      subgraph: null
    })}>
      {graph.subgraph ? "Subgraph exists" : "Subgraph does not exist"} 
    </div>
  )
}
```

Clicking the `<div>` will make the subgraph disappear from the top-level graph's resolved data. Note that the Graph instance itself still exists, and setting the value back to something non-null (i.e. true) will re-enable the subgraph.

All the structure of the graph state which is not a subgraph is replaceable.

### The third entry returned by useGraph

`useGraph` actually returns three values, and not two. The third value is another updating function, which overwrites the data of the returned graph state, instead of doing a smarter merge. 

```jsx
const Store = traph({
  firstName: "Tormod",
  lastName: "Haugland" 
})

function Component(){
  const [user, setUser, replaceUser] = dataGraph.useGraph("user.firstName")

  return (
    <div>
      <button onClick={() => setUser({newKey: "newValue"})}>Update</button>
      <button onClick={() => replaceUser({newKey: "anotherNewValue"})}>Replace</button>
      <div>
        {user.firstName}
        {user.lastName}
        {user.newKey}
      </div>
    </div>
  )
}
```

When clicking the first button, the new graph state will be 
```js
{
  firstName: "Tormod",
  lastName: "Tormod",
  newKey: "newValue",
}
```

But when clicking the second button, the new graph state will be

```js
{
  newKey: "anotherNewValue",
}
```

The object passed to `replaceUser` is accepted as the complete new state.

### Quirks

There are a few quirks to be wary off when using this library:
* If you mount a Graph at multiple locations in an above Graph, it's Provider will only be rendered once, as the traph deduplicates providers.
* There are two locations where you can supply initial data to a graph: As the first argument to it's constructor, but also in the `graphData` prop of the graph's Provider. The latter will always dominate.
* The internal data store (which is separate from the graph initial structure) is treated as immutable. Updating a complex data type (Object, Array), will always create a new object of the same type. However, in cases where new entries are added, these are added as-supplied to the graph.
* Functions located deeply within some data structure which _is not_ a graph, will not be rebound to take the `updateGraph` method.

### Behaviours explicitly listed as undefined by the library

The following behaviours are (currently) listed as undefined. Use at your own peril:
* Injecting subgraphs into a graph's state after creation.
* Adding complex object types (e.g. classes) with graphs located somewhere within the class.
* Adding functions as the initial data to a graph (the issue here is related to the fact that functions sent to React's useState internally calls the function).

### TODOS

* Dynamically adding subgraphs.
* Rebinding of deeply nested functions.
