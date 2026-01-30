import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import './YearChart.css'

const COLOR_SCALE = {
  selected: '#8b4d42',
  low: { r: 180, g: 200, b: 190 },
  high: { r: 58, g: 90, b: 78 },
}

function YearChart({ moviesByYear, selectedYear, onYearClick }) {
  const maxCount = useMemo(() => {
    return Math.max(...moviesByYear.map(d => d.count), 1)
  }, [moviesByYear])

  const getBarColor = (count, isSelected) => {
    if (isSelected) return COLOR_SCALE.selected

    const intensity = Math.log(count + 1) / Math.log(maxCount + 1)
    const r = Math.round(COLOR_SCALE.low.r + (COLOR_SCALE.high.r - COLOR_SCALE.low.r) * intensity)
    const g = Math.round(COLOR_SCALE.low.g + (COLOR_SCALE.high.g - COLOR_SCALE.low.g) * intensity)
    const b = Math.round(COLOR_SCALE.low.b + (COLOR_SCALE.high.b - COLOR_SCALE.low.b) * intensity)

    return `rgb(${r}, ${g}, ${b})`
  }

  const handleBarClick = (data) => {
    if (data && data.year) {
      onYearClick(data.year)
    }
  }

  const handleChartClick = (data) => {
    if (data && data.activeLabel) {
      onYearClick(data.activeLabel)
    }
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="year-tooltip">
          <span className="year-tooltip-year">{data.year}</span>
          <span className="year-tooltip-count">
            {data.count} {data.count === 1 ? 'movie' : 'movies'}
          </span>
        </div>
      )
    }
    return null
  }

  const formatXAxis = (year) => {
    if (moviesByYear.length > 30) {
      return year % 5 === 0 ? year : ''
    }
    return year
  }

  return (
    <div className="year-chart">
      <header className="year-chart-header">
        <h2>Movies by Year</h2>
        <p className="year-chart-subtitle">Click a bar to see movies from that year</p>
      </header>
      <div className="year-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={moviesByYear}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            onClick={handleChartClick}
          >
            <XAxis
              dataKey="year"
              tickFormatter={formatXAxis}
              tick={{ fill: '#5c6b62', fontSize: 12 }}
              tickLine={{ stroke: '#a9a192' }}
              axisLine={{ stroke: '#a9a192' }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fill: '#5c6b62', fontSize: 12 }}
              tickLine={{ stroke: '#a9a192' }}
              axisLine={{ stroke: '#a9a192' }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(42, 56, 48, 0.08)' }} />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={handleBarClick}
            >
              {moviesByYear.map((entry) => (
                <Cell
                  key={`cell-${entry.year}`}
                  fill={getBarColor(entry.count, selectedYear === entry.year)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default YearChart
