import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const csv = require('csv-parser')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const REQUEST_DELAY = 250

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url)
      if (response.status === 429) {
        console.log('Rate limited, waiting 10s...')
        await sleep(10000)
        continue
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      if (i === retries - 1) throw error
      await sleep(1000 * (i + 1))
    }
  }
}

async function findMovieByImdbId(imdbId) {
  const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`
  const data = await fetchWithRetry(url)
  return data.movie_results?.[0] || null
}

async function getMovieDetails(tmdbId) {
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
  return await fetchWithRetry(url)
}

async function getMovieCredits(tmdbId) {
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}`
  return await fetchWithRetry(url)
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = []
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        if (data['Title Type'] === 'Movie' && data['Const']) {
          results.push({
            imdbId: data['Const'],
            title: data['Title'],
            originalTitle: data['Original Title'],
            year: parseInt(data['Year']) || null,
            imdbRating: parseFloat(data['IMDb Rating']) || null,
            userRating: parseInt(data['Your Rating']) || null,
            genres: data['Genres'] ? data['Genres'].split(', ') : [],
            directors: data['Directors'] || ''
          })
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject)
  })
}

async function fetchMovieFromTMDB(csvData) {
  // Find movie in TMDB
  const tmdbMovie = await findMovieByImdbId(csvData.imdbId)
  if (!tmdbMovie) {
    return null
  }

  await sleep(REQUEST_DELAY)

  // Get full details
  const details = await getMovieDetails(tmdbMovie.id)
  await sleep(REQUEST_DELAY)

  // Get credits for director
  const credits = await getMovieCredits(tmdbMovie.id)
  await sleep(REQUEST_DELAY)

  const director = credits.crew?.find(c => c.job === 'Director')?.name ||
                   csvData.directors.split(',')[0]?.trim() || null

  const countries = details.production_countries || []
  if (countries.length === 0) {
    return null
  }

  const countryNames = {}
  for (const country of countries) {
    countryNames[country.iso_3166_1] = country.name
  }

  return {
    imdbId: csvData.imdbId,
    title: details.title || csvData.title,
    year: csvData.year || (details.release_date ? parseInt(details.release_date.substring(0, 4)) : null),
    poster: details.poster_path,
    rating: csvData.imdbRating || details.vote_average,
    userRating: csvData.userRating,
    director: director,
    genres: csvData.genres.length > 0 ? csvData.genres : (details.genres?.map(g => g.name) || []),
    countries: countries.map(c => c.iso_3166_1),
    countryNames: countryNames,
    tmdbId: tmdbMovie.id,
    fetchedAt: new Date().toISOString()
  }
}

async function main() {
  console.log('Sync Database: Incremental update from CSV files\n')

  // 1. Discover all CSV files in data/input/
  const inputDir = path.join(rootDir, 'data', 'input')
  const csvFiles = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'))

  if (csvFiles.length === 0) {
    console.error('No CSV files found in data/input/')
    process.exit(1)
  }

  // 2. Parse all CSVs and collect unique IMDb IDs
  console.log('Reading CSV files...')
  const allMoviesFromCSV = new Map()
  const listMappings = {}

  for (const csvFile of csvFiles) {
    const listName = path.basename(csvFile, '.csv')
    const csvPath = path.join(inputDir, csvFile)

    console.log(`  ${csvFile}...`)
    const movies = await parseCSV(csvPath)
    listMappings[listName] = []

    for (const movie of movies) {
      listMappings[listName].push(movie.imdbId)
      if (!allMoviesFromCSV.has(movie.imdbId)) {
        allMoviesFromCSV.set(movie.imdbId, movie)
      }
    }
    console.log(`    Found ${movies.length} movies`)
  }

  console.log(`\nTotal unique movies across all CSVs: ${allMoviesFromCSV.size}`)

  // 3. Load existing database
  const dbPath = path.join(rootDir, 'data', 'db', 'movies.json')
  let database = { version: 1, lastUpdated: null, movies: {} }

  if (fs.existsSync(dbPath)) {
    database = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    console.log(`Existing database has ${Object.keys(database.movies).length} movies`)
  } else {
    console.log('No existing database found, starting fresh')
  }

  // 4. Find missing movies
  const existingIds = new Set(Object.keys(database.movies))
  const newIds = [...allMoviesFromCSV.keys()].filter(id => !existingIds.has(id))

  console.log(`\nMovies to fetch from TMDB: ${newIds.length}`)

  // 5. Fetch only new movies from TMDB
  if (newIds.length > 0) {
    if (!TMDB_API_KEY) {
      console.error('\nError: TMDB_API_KEY environment variable is not set')
      console.error('Get an API key from https://www.themoviedb.org/settings/api')
      console.error('Then run: TMDB_API_KEY=your_key npm run data:sync')
      process.exit(1)
    }

    console.log('\nFetching new movies from TMDB...')
    let fetched = 0
    let failed = 0

    for (const imdbId of newIds) {
      const csvData = allMoviesFromCSV.get(imdbId)
      try {
        const movieData = await fetchMovieFromTMDB(csvData)

        if (movieData) {
          database.movies[imdbId] = movieData
          fetched++
          if (fetched % 50 === 0) {
            console.log(`  Fetched ${fetched}/${newIds.length}...`)
          }
        } else {
          console.log(`  [SKIP] ${csvData.title} - Not found in TMDB or no production countries`)
          failed++
        }
      } catch (error) {
        console.log(`  [ERROR] ${csvData.title}: ${error.message}`)
        failed++
      }
    }

    console.log(`\nFetch complete: ${fetched} added, ${failed} failed`)
  }

  // 6. Update userRating for existing movies (might have changed in CSV)
  console.log('\nUpdating user ratings from CSV...')
  let ratingsUpdated = 0

  for (const [imdbId, csvData] of allMoviesFromCSV) {
    if (database.movies[imdbId] && csvData.userRating !== null) {
      if (database.movies[imdbId].userRating !== csvData.userRating) {
        database.movies[imdbId].userRating = csvData.userRating
        ratingsUpdated++
      }
    }
  }
  console.log(`  Updated ${ratingsUpdated} user ratings`)

  // 7. Save updated database
  database.lastUpdated = new Date().toISOString()
  fs.writeFileSync(dbPath, JSON.stringify(database, null, 2))
  console.log(`\nSaved database to data/db/movies.json`)
  console.log(`  Total movies in database: ${Object.keys(database.movies).length}`)

  // 8. Generate list reference files
  console.log('\nUpdating list reference files...')
  const listsDir = path.join(rootDir, 'data', 'lists')

  for (const [listName, movieIds] of Object.entries(listMappings)) {
    const inDb = movieIds.filter(id => database.movies[id]).length

    const listData = {
      name: listName.charAt(0).toUpperCase() + listName.slice(1),
      source: `${listName}.csv`,
      lastSynced: new Date().toISOString(),
      movieIds: movieIds
    }

    const listPath = path.join(listsDir, `${listName}.json`)
    fs.writeFileSync(listPath, JSON.stringify(listData, null, 2))
    console.log(`  ${listName}: ${movieIds.length} movies (${inDb} in database)`)
  }

  console.log('\nSync complete!')
}

main().catch(console.error)
