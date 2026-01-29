import { useState } from 'react'
import './MovieCard.css'

function MovieCard({ movie, isHighlighted, onMovieClick }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const posterUrl = movie.poster
    ? (movie.poster.startsWith('http')
      ? movie.poster
      : `https://image.tmdb.org/t/p/w185${movie.poster}`)
    : null

  const handleCardClick = () => {
    onMovieClick?.(movie)
  }

  return (
    <div
      className={`movie-card ${isHighlighted ? 'movie-card--highlighted' : ''}`}
      onClick={handleCardClick}
    >
      <div className="movie-poster">
        {posterUrl && !imageError ? (
          <>
            {!imageLoaded && <div className="poster-placeholder"></div>}
            <img
              src={posterUrl}
              alt={`${movie.title} poster`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={imageLoaded ? 'loaded' : 'loading'}
              loading="lazy"
              decoding="async"
            />
          </>
        ) : (
          <div className="poster-placeholder">
            <span>🎬</span>
          </div>
        )}
      </div>

      <div className="movie-info">
        <h3 className="movie-title">{movie.title}</h3>
        <div className="movie-meta">
          <span className="movie-year">{movie.year}</span>
          {movie.director && (
            <span className="movie-director">• {movie.director}</span>
          )}
        </div>

        <div className="movie-ratings">
          {movie.rating && (
            <span className="rating imdb">
              <span className="rating-icon">⭐</span>
              {movie.rating.toFixed(1)}
            </span>
          )}
          {movie.userRating && (
            <span className="rating user">
              <span className="rating-icon">👤</span>
              {movie.userRating}
            </span>
          )}
        </div>

        {movie.genres && movie.genres.length > 0 && (
          <div className="movie-genres">
            {movie.genres.slice(0, 3).map((genre) => (
              <span key={genre} className="genre-tag">
                {genre}
              </span>
            ))}
          </div>
        )}

        {movie.isCoProduction && (
          <div className="co-production-badge" title={`Co-production: ${movie.allCountries?.join(', ')}`}>
            🌐 Co-production
          </div>
        )}

        <a
          href={`https://www.imdb.com/title/${movie.imdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="imdb-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on IMDb
        </a>
      </div>
    </div>
  )
}

export default MovieCard
