import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

function buildCountryView(database, movieIds) {
  const byCountry = {}

  for (const imdbId of movieIds) {
    const movie = database.movies[imdbId]
    if (!movie || !movie.countries || movie.countries.length === 0) {
      continue
    }

    const isCoProduction = movie.countries.length > 1

    const movieData = {
      imdbId: movie.imdbId,
      title: movie.title,
      year: movie.year,
      poster: movie.poster,
      rating: movie.rating,
      userRating: movie.userRating,
      director: movie.director,
      genres: movie.genres,
      isCoProduction: isCoProduction,
      allCountries: movie.countries
    }

    for (const countryCode of movie.countries) {
      if (!byCountry[countryCode]) {
        byCountry[countryCode] = {
          name: movie.countryNames[countryCode] || countryCode,
          count: 0,
          movies: []
        }
      }
      byCountry[countryCode].movies.push(movieData)
      byCountry[countryCode].count++
    }
  }

  return byCountry
}

async function main() {
  console.log('Build Views: Generating UI views from central database\n')

  // Load central database
  const dbPath = path.join(rootDir, 'data', 'db', 'movies.json')
  if (!fs.existsSync(dbPath)) {
    console.error('Error: data/db/movies.json not found')
    console.error('Please run "npm run data:sync" first')
    process.exit(1)
  }

  console.log('Loading central database...')
  const database = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  console.log(`  ${Object.keys(database.movies).length} movies in database`)

  // Load list references
  const listsDir = path.join(rootDir, 'data', 'lists')
  const listFiles = fs.readdirSync(listsDir).filter(f => f.endsWith('.json'))

  if (listFiles.length === 0) {
    console.error('Error: No list files found in data/lists/')
    console.error('Please run "npm run data:sync" first')
    process.exit(1)
  }

  // Define view mappings (list name -> output file name)
  const viewMappings = {
    'watchlist': 'movies-by-country.json',
    'festival': 'festival-movies-by-country.json'
  }

  const outputDir = path.join(rootDir, 'src', 'data')

  console.log('\nGenerating views...')

  for (const listFile of listFiles) {
    const listName = path.basename(listFile, '.json')
    const listPath = path.join(listsDir, listFile)
    const listData = JSON.parse(fs.readFileSync(listPath, 'utf8'))

    // Determine output filename
    const outputFileName = viewMappings[listName] || `${listName}-movies-by-country.json`
    const outputPath = path.join(outputDir, outputFileName)

    // Build country view
    const countryView = buildCountryView(database, listData.movieIds)
    const countryCount = Object.keys(countryView).length
    const movieCount = listData.movieIds.filter(id => database.movies[id]).length

    // Write output
    fs.writeFileSync(outputPath, JSON.stringify(countryView, null, 2))

    console.log(`  ${listData.name}:`)
    console.log(`    ${movieCount} movies across ${countryCount} countries`)
    console.log(`    -> src/data/${outputFileName}`)
  }

  console.log('\nViews generated successfully!')
}

main().catch(console.error)
