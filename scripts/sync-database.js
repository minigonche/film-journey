import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const csv = require('csv-parser')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const missingPath = path.join(rootDir, 'data', 'input', 'missing.json')
const countriesCsvPath = path.join(rootDir, 'data', 'input', 'countries.csv')

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const REQUEST_DELAY = 250

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Missing.json handling
function loadMissing() {
  if (fs.existsSync(missingPath)) {
    return JSON.parse(fs.readFileSync(missingPath, 'utf8'))
  }
  return {}
}

function saveMissing(missing) {
  fs.writeFileSync(missingPath, JSON.stringify(missing, null, 2))
}

function isManualEntryComplete(entry) {
  // Only require countries array - names will be inferred from countries.csv
  return entry.countries &&
         Array.isArray(entry.countries) &&
         entry.countries.length > 0
}

function createMissingEntry(csvData, reason) {
  return {
    imdbId: csvData.imdbId,
    title: csvData.title,
    year: csvData.year,
    director: csvData.directors || '',
    genres: csvData.genres || [],
    imdbRating: csvData.imdbRating,
    userRating: csvData.userRating,
    reason: reason,
    countries: [],
    addedAt: new Date().toISOString()
  }
}

function createMovieFromManualEntry(entry, csvData, countryLookup) {
  // Build countryNames from country codes using the lookup
  const countryNames = {}
  for (const code of entry.countries) {
    countryNames[code] = countryLookup.get(code) || code
  }

  return {
    imdbId: entry.imdbId,
    title: entry.title,
    year: entry.year,
    poster: entry.poster || null,
    rating: csvData.imdbRating || entry.imdbRating,
    userRating: csvData.userRating || entry.userRating,
    director: entry.director || csvData.directors?.split(',')[0]?.trim() || null,
    genres: csvData.genres?.length > 0 ? csvData.genres : (entry.genres || []),
    countries: entry.countries,
    countryNames: countryNames,
    tmdbId: entry.tmdbId || null,
    fetchedAt: new Date().toISOString(),
    source: 'manual'
  }
}

function loadExistingCountriesCsv() {
  const countries = new Map()
  if (fs.existsSync(countriesCsvPath)) {
    const content = fs.readFileSync(countriesCsvPath, 'utf8')
    const lines = content.trim().split('\n').slice(1) // Skip header
    for (const line of lines) {
      const match = line.match(/^([A-Z]{2}),(.+)$/)
      if (match) {
        countries.set(match[1], match[2].replace(/^"|"$/g, ''))
      }
    }
  }
  return countries
}

function updateCountriesCsv(database) {
  // Load existing CSV to preserve manually corrected names
  const countries = loadExistingCountriesCsv()

  // Add/update countries from database (only if better name available)
  for (const movie of Object.values(database.movies)) {
    if (movie.countryNames) {
      for (const [code, name] of Object.entries(movie.countryNames)) {
        const existing = countries.get(code)
        // Add if new, or update if current is just the code and we have a real name
        if (!existing) {
          countries.set(code, name)
        } else if (existing === code && name !== code) {
          countries.set(code, name)
        }
      }
    }
  }

  // Sort by code and write CSV
  const sortedCodes = [...countries.keys()].sort()
  const csvLines = ['code,name']
  for (const code of sortedCodes) {
    const name = countries.get(code)
    // Escape names with commas
    const safeName = name.includes(',') ? `"${name}"` : name
    csvLines.push(`${code},${safeName}`)
  }

  fs.writeFileSync(countriesCsvPath, csvLines.join('\n') + '\n')
  return countries.size
}

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
  const EXCLUDED_TYPES = ['Music Video', 'TV Episode']
  return new Promise((resolve, reject) => {
    const results = []
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        if (data['Const'] && !EXCLUDED_TYPES.includes(data['Title Type'])) {
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

  // 1. Discover all CSV files in data/input/ (excluding reference files)
  const inputDir = path.join(rootDir, 'data', 'input')
  const excludedCsvFiles = ['countries.csv']
  const csvFiles = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv') && !excludedCsvFiles.includes(f))

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

  // 5. Load missing.json for manual entries and country lookup
  const missing = loadMissing()
  const countryLookup = loadExistingCountriesCsv()
  const initialMissingCount = Object.keys(missing).length
  let newMissingEntries = []
  let usedManualEntries = []

  // 6. Fetch only new movies from TMDB (or use manual entries)
  if (newIds.length > 0) {
    console.log('\nProcessing new movies...')
    let fetched = 0
    let fromManual = 0
    let failed = 0

    for (const imdbId of newIds) {
      const csvData = allMoviesFromCSV.get(imdbId)

      // First check if there's a complete manual entry in missing.json
      if (missing[imdbId] && isManualEntryComplete(missing[imdbId])) {
        const movieData = createMovieFromManualEntry(missing[imdbId], csvData, countryLookup)
        database.movies[imdbId] = movieData
        usedManualEntries.push({ id: imdbId, title: csvData.title })
        delete missing[imdbId]
        fromManual++
        console.log(`  [MANUAL] ${csvData.title} - Used manual entry`)
        continue
      }

      // Try TMDB if we have an API key
      if (TMDB_API_KEY) {
        try {
          const movieData = await fetchMovieFromTMDB(csvData)

          if (movieData) {
            database.movies[imdbId] = movieData
            // Remove from missing if it was there (partial entry)
            if (missing[imdbId]) {
              delete missing[imdbId]
            }
            fetched++
            if (fetched % 50 === 0) {
              console.log(`  Fetched ${fetched}/${newIds.length}...`)
            }
            continue
          }
        } catch (error) {
          console.log(`  [ERROR] ${csvData.title}: ${error.message}`)
        }
      }

      // If we get here, TMDB failed - add to missing.json if not already there
      if (!missing[imdbId]) {
        const reason = !TMDB_API_KEY ? 'No TMDB API key' : 'Not found in TMDB or no production countries'
        missing[imdbId] = createMissingEntry(csvData, reason)
        newMissingEntries.push({ id: imdbId, title: csvData.title })
        console.log(`  [MISSING] ${csvData.title} - Added to missing.json`)
      }
      failed++
    }

    console.log(`\nFetch complete: ${fetched} from TMDB, ${fromManual} from manual entries, ${failed} failed`)
  }

  // 7. Save updated missing.json
  saveMissing(missing)
  const finalMissingCount = Object.keys(missing).length

  // Alert about missing entries
  if (newMissingEntries.length > 0) {
    console.log(`\n⚠️  NEW MISSING ENTRIES: ${newMissingEntries.length} movies need manual data`)
    console.log('   Edit data/input/missing.json to add country info, then run data:update again')
    console.log('   New entries:')
    for (const entry of newMissingEntries) {
      console.log(`     - ${entry.title} (${entry.id})`)
    }
  }

  if (usedManualEntries.length > 0) {
    console.log(`\n✓  Used ${usedManualEntries.length} manual entries from missing.json`)
  }

  if (finalMissingCount > 0) {
    console.log(`\n📋 Missing entries remaining: ${finalMissingCount}`)
    console.log('   Run data:update again after filling in the country data')
  }

  // 8. Update userRating for existing movies (might have changed in CSV)
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

  // 9. Save updated database
  database.lastUpdated = new Date().toISOString()
  fs.writeFileSync(dbPath, JSON.stringify(database, null, 2))
  console.log(`\nSaved database to data/db/movies.json`)
  console.log(`  Total movies in database: ${Object.keys(database.movies).length}`)

  // 10. Update countries reference CSV
  const countryCount = updateCountriesCsv(database)
  console.log(`\nUpdated countries.csv with ${countryCount} countries`)

  // 11. Generate list reference files
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
