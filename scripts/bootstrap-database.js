import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const csv = require('csv-parser')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// Parse CSV file and extract IMDb IDs
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = []
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        if (data['Title Type'] === 'Movie' && data['Const']) {
          results.push({
            imdbId: data['Const'],
            userRating: parseInt(data['Your Rating']) || null
          })
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject)
  })
}

async function main() {
  console.log('Bootstrap Migration: Converting existing data to central database format\n')

  // 1. Read existing movies-by-country.json
  const existingDataPath = path.join(rootDir, 'src', 'data', 'movies-by-country.json')
  if (!fs.existsSync(existingDataPath)) {
    console.error('Error: src/data/movies-by-country.json not found')
    console.error('Please run the original fetch-movie-data.js first or ensure the file exists')
    process.exit(1)
  }

  console.log('Reading existing movies-by-country.json...')
  const moviesByCountry = JSON.parse(fs.readFileSync(existingDataPath, 'utf8'))

  // 2. Deduplicate movies and build central database
  console.log('Building central database (deduplicating movies)...')
  const movies = {}
  const countryNames = {}

  for (const [countryCode, countryData] of Object.entries(moviesByCountry)) {
    countryNames[countryCode] = countryData.name

    for (const movie of countryData.movies) {
      if (!movies[movie.imdbId]) {
        // Build countryNames object for this movie
        const movieCountryNames = {}
        for (const code of movie.allCountries) {
          movieCountryNames[code] = countryNames[code] || code
        }

        movies[movie.imdbId] = {
          imdbId: movie.imdbId,
          title: movie.title,
          year: movie.year,
          poster: movie.poster,
          rating: movie.rating,
          userRating: movie.userRating,
          director: movie.director,
          genres: movie.genres,
          countries: movie.allCountries,
          countryNames: movieCountryNames,
          fetchedAt: new Date().toISOString()
        }
      }
    }
  }

  // Update countryNames after processing all countries
  for (const movie of Object.values(movies)) {
    for (const code of movie.countries) {
      if (countryNames[code] && !movie.countryNames[code]) {
        movie.countryNames[code] = countryNames[code]
      }
    }
  }

  const database = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    movies: movies
  }

  const uniqueCount = Object.keys(movies).length
  console.log(`  Found ${uniqueCount} unique movies`)

  // 3. Save central database
  const dbPath = path.join(rootDir, 'data', 'db', 'movies.json')
  fs.writeFileSync(dbPath, JSON.stringify(database, null, 2))
  console.log(`  Saved to data/db/movies.json`)

  // 4. Read CSV files and create list references
  console.log('\nCreating list reference files...')

  const inputDir = path.join(rootDir, 'data', 'input')
  const listsDir = path.join(rootDir, 'data', 'lists')

  const csvFiles = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'))

  for (const csvFile of csvFiles) {
    const listName = path.basename(csvFile, '.csv')
    const csvPath = path.join(inputDir, csvFile)

    console.log(`  Processing ${csvFile}...`)
    const csvMovies = await parseCSV(csvPath)
    const movieIds = csvMovies.map(m => m.imdbId)

    // Count how many are in the database
    const inDb = movieIds.filter(id => movies[id]).length
    const notInDb = movieIds.length - inDb

    const listData = {
      name: listName.charAt(0).toUpperCase() + listName.slice(1),
      source: csvFile,
      lastSynced: new Date().toISOString(),
      movieIds: movieIds
    }

    const listPath = path.join(listsDir, `${listName}.json`)
    fs.writeFileSync(listPath, JSON.stringify(listData, null, 2))
    console.log(`    ${movieIds.length} movies (${inDb} in database, ${notInDb} missing)`)
    console.log(`    Saved to data/lists/${listName}.json`)
  }

  console.log('\nBootstrap migration complete!')
  console.log('\nNext steps:')
  console.log('  1. Run "npm run data:sync" to fetch any missing movies from TMDB')
  console.log('  2. Run "npm run data:views" to regenerate the UI views')
}

main().catch(console.error)
