# Traph


## Installation

```
yarn add react-traph
```

## Example

```tsx
import graph from 'react-traph'
import ReactDOM from 'react-dom

const Store = graph({
  user: {
    firstName: "Tormod",
    lastName: "Haugland
  },
  toasts: graph({
    items: [],
    addToast(message){
      this.updateGraph({
        items: this.items.concat({message})
      })
    }
  })
})

function Toast({message}){
  const [lastName, setLastName] = Store.useGraph("user.lastName")
  return (
    <div onClick={() => setLastName(message)}>
      {message}
    </div>
  )
}


function ToastContainer(){
  const [toasts] = Store.useGraph("toasts")

  return (
    <div onClick={() => toasts.addToast("New toast!")}>
      Hey {user.firstName}! Click me!
      {toasts.map(toast => <Toast message={toast.message} />)}

    </div>
  )
}

function UserForm(){
  const [user, setUser] = Store.useGraph("user")
  return ( 
    <form>
      <input value={user.firstName} onChange={e => setUser({firstName: e.target.value})} /> 
      <input value={user.lastName} onChange={e => setUser({lastName: e.target.value})} /> 
    </form>
  )
}

ReactDOM.render(
  <Store.Provider>
    <UserForm />
    <ToastContainer />
  </Store.Provider>
)
```

## User guide


## Recipes
