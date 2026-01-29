import { useEffect, useState } from 'react'

const dataUrls = {
  all: new URL('../data/movies-by-country.json', import.meta.url),
  festival: new URL('../data/festival-movies-by-country.json', import.meta.url),
}

function useMovieDatasets() {
  const [datasets, setDatasets] = useState({ all: {}, festival: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const [allResponse, festivalResponse] = await Promise.all([
          fetch(dataUrls.all),
          fetch(dataUrls.festival),
        ])

        if (!allResponse.ok) {
          throw new Error('Failed to load watchlist data')
        }
        if (!festivalResponse.ok) {
          throw new Error('Failed to load festival data')
        }

        const [allData, festivalData] = await Promise.all([
          allResponse.json(),
          festivalResponse.json(),
        ])

        if (isMounted) {
          setDatasets({
            all: allData,
            festival: festivalData,
          })
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  return { datasets, loading, error }
}

export default useMovieDatasets
