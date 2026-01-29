import './Layout.css'

function Layout({ sidebar, map }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        {sidebar}
      </aside>
      <main className="map-container">
        {map}
      </main>
    </div>
  )
}

export default Layout
