import { useMemo } from 'react'
import MovieCard from './MovieCard'
import useInfiniteScroll from '../hooks/useInfiniteScroll'
import './MovieList.css'

function MovieList({ selectedCountry, onClearSelection, dataMode, onDataModeChange, datasetCounts, highlightedMovieId, onMovieClick }) {
  // Sort movies by user rating (descending)
  const sortedMovies = useMemo(() => {
    if (!selectedCountry?.movies) return []
    return [...selectedCountry.movies].sort((a, b) => (b.userRating || 0) - (a.userRating || 0))
  }, [selectedCountry])

  const { displayedItems, hasMore, lastItemRef } = useInfiniteScroll(sortedMovies, 20)

  return (
    <div className="movie-list">
      <div className="movie-list-toolbar">
        <span className="dataset-label">Dataset</span>
        <div className="dataset-toggle">
          <button
            type="button"
            className={`toggle-btn ${dataMode === 'all' ? 'active' : ''}`}
            onClick={() => onDataModeChange('all')}
          >
            Watchlist <span className="toggle-count">({datasetCounts?.all || 0})</span>
          </button>
          <button
            type="button"
            className={`toggle-btn ${dataMode === 'festival' ? 'active' : ''}`}
            onClick={() => onDataModeChange('festival')}
          >
            Festival <span className="toggle-count">({datasetCounts?.festival || 0})</span>
          </button>
        </div>
      </div>

      {!selectedCountry ? (
        <div className="empty-state">
          <div className="empty-content">
            <div className="globe-icon">🌍</div>
            <h2>Select a Country</h2>
            <p>Click on a country in the map to see the movies you've watched from there.</p>
          </div>
        </div>
      ) : (
        <>
          <header className="movie-list-header">
            <div className="header-info">
              <h2>{selectedCountry.name}</h2>
              <span className="movie-count">
                {selectedCountry.count} {selectedCountry.count === 1 ? 'movie' : 'movies'}
              </span>
            </div>
            <button className="clear-btn" onClick={onClearSelection}>
              ✕
            </button>
          </header>

          {selectedCountry.movies.length === 0 ? (
            <div className="no-movies">
              <p>No movies watched from this country yet.</p>
            </div>
          ) : (
            <div className="movie-grid">
              {displayedItems.map((movie, index) => {
                const isLast = index === displayedItems.length - 1
                const revealDelay = `${Math.min(index, 12) * 40}ms`
                return (
                  <div
                    key={movie.imdbId}
                    ref={isLast ? lastItemRef : null}
                    style={{ '--reveal-delay': revealDelay }}
                  >
                    <MovieCard
                      movie={movie}
                      isHighlighted={highlightedMovieId === movie.imdbId}
                      onMovieClick={onMovieClick}
                    />
                  </div>
                )
              })}
              {hasMore && (
                <div className="loading-more">
                  <div className="loader small"></div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MovieList
