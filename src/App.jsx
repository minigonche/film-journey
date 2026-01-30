import { useMemo, useState } from 'react'
import Layout from './components/Layout'
import WorldMap from './components/WorldMap'
import YearChart from './components/YearChart'
import ViewToggle from './components/ViewToggle'
import MovieList from './components/MovieList'
import useMovieDatasets from './hooks/useMovieDatasets'

function App() {
  const { datasets, loading, error } = useMovieDatasets()
  const [dataMode, setDataMode] = useState('all')
  const [viewMode, setViewMode] = useState('map')
  const [selectedCountryCode, setSelectedCountryCode] = useState(null)
  const [selectedCountryName, setSelectedCountryName] = useState('')
  const [selectedYear, setSelectedYear] = useState(null)
  const [highlightedMovieId, setHighlightedMovieId] = useState(null)

  const handleCountryClick = (countryCode, countryName) => {
    setSelectedCountryCode(countryCode)
    setSelectedCountryName(countryName)
    setSelectedYear(null)
    setHighlightedMovieId(null)
  }

  const handleClearSelection = () => {
    setSelectedCountryCode(null)
    setSelectedCountryName('')
    setSelectedYear(null)
    setHighlightedMovieId(null)
  }

  const handleYearClick = (year) => {
    setSelectedYear(prev => prev === year ? null : year)
    setSelectedCountryCode(null)
    setSelectedCountryName('')
    setHighlightedMovieId(null)
  }

  const handleViewChange = (mode) => {
    setViewMode(mode)
    setSelectedCountryCode(null)
    setSelectedCountryName('')
    setSelectedYear(null)
    setHighlightedMovieId(null)
  }

  const handleMovieClick = (movie) => {
    setHighlightedMovieId(prev => prev === movie.imdbId ? null : movie.imdbId)
  }

  const movieData = datasets[dataMode] || {}

  const moviesByYear = useMemo(() => {
    const uniqueMovies = new Map()
    Object.values(movieData).forEach(country => {
      country.movies?.forEach(movie => {
        if (!uniqueMovies.has(movie.imdbId)) {
          uniqueMovies.set(movie.imdbId, movie)
        }
      })
    })

    const yearMap = {}
    let minYear = Infinity
    let maxYear = -Infinity

    uniqueMovies.forEach(movie => {
      const year = movie.year
      if (year) {
        minYear = Math.min(minYear, year)
        maxYear = Math.max(maxYear, year)
        if (!yearMap[year]) {
          yearMap[year] = { year, count: 0, movies: [] }
        }
        yearMap[year].count++
        yearMap[year].movies.push(movie)
      }
    })

    // Fill in missing years with zero counts
    const result = []
    if (minYear !== Infinity) {
      for (let year = minYear; year <= maxYear; year++) {
        result.push(yearMap[year] || { year, count: 0, movies: [] })
      }
    }

    return result
  }, [movieData])

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
    if (selectedYear) {
      const yearData = moviesByYear.find(y => y.year === selectedYear)
      return {
        code: null,
        name: `Year ${selectedYear}`,
        count: yearData?.count || 0,
        movies: yearData?.movies || []
      }
    }
    if (!selectedCountryCode) return null
    const data = movieData[selectedCountryCode]
    return {
      code: selectedCountryCode,
      name: selectedCountryName || data?.name || selectedCountryCode,
      count: data?.count || 0,
      movies: data?.movies || []
    }
  }, [selectedCountryCode, selectedCountryName, selectedYear, movieData, moviesByYear])

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
          viewMode={viewMode}
        />
      }
      map={
        <>
          <ViewToggle viewMode={viewMode} onViewChange={handleViewChange} />
          {viewMode === 'map' ? (
            <WorldMap
              movieData={movieData}
              selectedCountry={selectedCountry}
              onCountryClick={handleCountryClick}
              highlightedCountries={highlightedCountries}
            />
          ) : (
            <YearChart
              moviesByYear={moviesByYear}
              selectedYear={selectedYear}
              onYearClick={handleYearClick}
            />
          )}
        </>
      }
    />
  )
}

export default App
