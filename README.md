# Film Journey

A React application for visualizing your movie watchlist on a world map, organized by production country.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Data Pipeline

The app uses a central movie database that syncs from CSV files exported from IMDb.

### Folder Structure

```
data/
├── input/           # Place your CSV files here
│   ├── watchlist.csv
│   └── festival.csv
├── db/
│   └── movies.json  # Central database (auto-generated)
└── lists/
    ├── watchlist.json
    └── festival.json
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run data:sync` | Reads CSVs from `data/input/`, fetches NEW movies from TMDB, updates central database |
| `npm run data:views` | Generates UI views (`src/data/*.json`) from central database |
| `npm run data:update` | Runs sync + views together (use this for regular updates) |
| `npm run data:bootstrap` | One-time migration from old format to central database |

### Updating Your Movie Lists

1. Export your watchlist/ratings from IMDb as CSV
2. Replace `data/input/watchlist.csv` or `data/input/festival.csv`
3. Run:
   ```bash
   npm run data:update
   ```

Only new movies (not already in the database) will be fetched from TMDB, making updates fast.

### Environment Variables

Create a `.env` file with your TMDB API key:

```
TMDB_API_KEY=your_api_key_here
```

Get an API key from https://www.themoviedb.org/settings/api
