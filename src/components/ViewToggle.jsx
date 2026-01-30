import './ViewToggle.css'

function ViewToggle({ viewMode, onViewChange }) {
  return (
    <div className="view-toggle">
      <button
        type="button"
        className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
        onClick={() => onViewChange('map')}
        title="Map View"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </button>
      <button
        type="button"
        className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
        onClick={() => onViewChange('timeline')}
        title="Timeline View"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/>
          <path d="M7 16l4-8 4 5 5-7"/>
        </svg>
      </button>
    </div>
  )
}

export default ViewToggle
