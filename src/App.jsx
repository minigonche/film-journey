import { useMemo, useState } from 'react'
import Layout from './components/Layout'
import WorldMap from './components/WorldMap'
import MovieList from './components/MovieList'
import useMovieDatasets from './hooks/useMovieDatasets'

function App() {
  const { datasets, loading, error } = useMovieDatasets()
  const [dataMode, setDataMode] = useState('all')
  const [selectedCountryCode, setSelectedCountryCode] = useState(null)
  const [selectedCountryName, setSelectedCountryName] = useState('')
  const [highlightedMovieId, setHighlightedMovieId] = useState(null)

  const handleCountryClick = (countryCode, countryName) => {
    setSelectedCountryCode(countryCode)
    setSelectedCountryName(countryName)
    setHighlightedMovieId(null)
  }

  const handleClearSelection = () => {
    setSelectedCountryCode(null)
    setSelectedCountryName('')
    setHighlightedMovieId(null)
  }

  const handleMovieClick = (movie) => {
    setHighlightedMovieId(prev => prev === movie.imdbId ? null : movie.imdbId)
  }

  const movieData = datasets[dataMode] || {}

  const datasetCounts = useMemo(() => {
    const countMovies = (data) => {
      if (!data) return 0
      const uniqueIds = new Set()
      Object.values(data).forEach(country => {
        country.movies?.forEach(movie => uniqueIds.add(movie.imdbId))
      })
      return uniqueIds.size
    }
    return {
      all: countMovies(datasets.all),
      festival: countMovies(datasets.festival)
    }
  }, [datasets])

  const selectedCountry = useMemo(() => {
    if (!selectedCountryCode) return null
    const data = movieData[selectedCountryCode]
    return {
      code: selectedCountryCode,
      name: selectedCountryName || data?.name || selectedCountryCode,
      count: data?.count || 0,
      movies: data?.movies || []
    }
  }, [selectedCountryCode, selectedCountryName, movieData])

  const highlightedCountries = useMemo(() => {
    if (!highlightedMovieId || !selectedCountry) return []
    const movie = selectedCountry.movies.find(m => m.imdbId === highlightedMovieId)
    return movie?.allCountries || []
  }, [highlightedMovieId, selectedCountry])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading movie data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-screen">
        <p>Error loading data: {error}</p>
      </div>
    )
  }

  return (
    <Layout
      sidebar={
        <MovieList
          selectedCountry={selectedCountry}
          onClearSelection={handleClearSelection}
          dataMode={dataMode}
          onDataModeChange={setDataMode}
          datasetCounts={datasetCounts}
          highlightedMovieId={highlightedMovieId}
          onMovieClick={handleMovieClick}
        />
      }
      map={
        <WorldMap
          movieData={movieData}
          selectedCountry={selectedCountry}
          onCountryClick={handleCountryClick}
          highlightedCountries={highlightedCountries}
        />
      }
    />
  )
}

export default App
