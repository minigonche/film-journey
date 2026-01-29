import { useMemo } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from 'react-simple-maps'
import { Tooltip } from 'react-tooltip'
import './WorldMap.css'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
// Bon Iver palette - soft teals from the lake, forest greens, muted red canoe
const COLOR_SCALE = {
  empty: '#d5d0c6',
  emptyHover: '#c5c0b5',
  selected: '#8b4d42',
  selectedHover: '#a65d50',
  stroke: '#a9a192',
  low: { r: 180, g: 200, b: 190 },
  high: { r: 58, g: 90, b: 78 },
}

// Map ISO_N3 (numeric) to ISO_A2 (alpha-2 codes)
const numericToAlpha2 = {
  '004': 'AF', '008': 'AL', '012': 'DZ', '020': 'AD', '024': 'AO', '028': 'AG', '032': 'AR',
  '051': 'AM', '036': 'AU', '040': 'AT', '031': 'AZ', '044': 'BS', '048': 'BH', '050': 'BD',
  '052': 'BB', '112': 'BY', '056': 'BE', '084': 'BZ', '204': 'BJ', '064': 'BT', '068': 'BO',
  '070': 'BA', '072': 'BW', '076': 'BR', '096': 'BN', '100': 'BG', '854': 'BF', '108': 'BI',
  '132': 'CV', '116': 'KH', '120': 'CM', '124': 'CA', '140': 'CF', '148': 'TD', '152': 'CL',
  '156': 'CN', '170': 'CO', '174': 'KM', '178': 'CG', '180': 'CD', '188': 'CR', '384': 'CI',
  '191': 'HR', '192': 'CU', '196': 'CY', '203': 'CZ', '208': 'DK', '262': 'DJ', '212': 'DM',
  '214': 'DO', '218': 'EC', '818': 'EG', '222': 'SV', '226': 'GQ', '232': 'ER', '233': 'EE',
  '748': 'SZ', '231': 'ET', '242': 'FJ', '246': 'FI', '250': 'FR', '266': 'GA', '270': 'GM',
  '268': 'GE', '276': 'DE', '288': 'GH', '300': 'GR', '308': 'GD', '320': 'GT', '324': 'GN',
  '624': 'GW', '328': 'GY', '332': 'HT', '340': 'HN', '348': 'HU', '352': 'IS', '356': 'IN',
  '360': 'ID', '364': 'IR', '368': 'IQ', '372': 'IE', '376': 'IL', '380': 'IT', '388': 'JM',
  '392': 'JP', '400': 'JO', '398': 'KZ', '404': 'KE', '296': 'KI', '408': 'KP', '410': 'KR',
  '414': 'KW', '417': 'KG', '418': 'LA', '428': 'LV', '422': 'LB', '426': 'LS', '430': 'LR',
  '434': 'LY', '438': 'LI', '440': 'LT', '442': 'LU', '450': 'MG', '454': 'MW', '458': 'MY',
  '462': 'MV', '466': 'ML', '470': 'MT', '584': 'MH', '478': 'MR', '480': 'MU', '484': 'MX',
  '583': 'FM', '498': 'MD', '492': 'MC', '496': 'MN', '499': 'ME', '504': 'MA', '508': 'MZ',
  '104': 'MM', '516': 'NA', '520': 'NR', '524': 'NP', '528': 'NL', '554': 'NZ', '558': 'NI',
  '562': 'NE', '566': 'NG', '807': 'MK', '578': 'NO', '512': 'OM', '586': 'PK', '585': 'PW',
  '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE', '608': 'PH', '616': 'PL', '620': 'PT',
  '634': 'QA', '642': 'RO', '643': 'RU', '646': 'RW', '659': 'KN', '662': 'LC', '670': 'VC',
  '882': 'WS', '674': 'SM', '678': 'ST', '682': 'SA', '686': 'SN', '688': 'RS', '690': 'SC',
  '694': 'SL', '702': 'SG', '703': 'SK', '705': 'SI', '090': 'SB', '706': 'SO', '710': 'ZA',
  '728': 'SS', '724': 'ES', '144': 'LK', '729': 'SD', '740': 'SR', '752': 'SE', '756': 'CH',
  '760': 'SY', '158': 'TW', '762': 'TJ', '834': 'TZ', '764': 'TH', '626': 'TL', '768': 'TG',
  '776': 'TO', '780': 'TT', '788': 'TN', '792': 'TR', '795': 'TM', '798': 'TV', '800': 'UG',
  '804': 'UA', '784': 'AE', '826': 'GB', '840': 'US', '858': 'UY', '860': 'UZ', '548': 'VU',
  '336': 'VA', '862': 'VE', '704': 'VN', '887': 'YE', '894': 'ZM', '716': 'ZW',
  '-99': 'XK', // Kosovo
}

function WorldMap({ movieData, selectedCountry, onCountryClick, highlightedCountries = [] }) {
  // Calculate max movie count for color scale
  const maxCount = useMemo(() => {
    return Math.max(...Object.values(movieData).map(d => d.count || 0), 1)
  }, [movieData])

  // Get color based on movie count
  const getCountryColor = (countryCode, isSelected, isHovered) => {
    if (isSelected) {
      return COLOR_SCALE.selected
    }

    const data = movieData[countryCode]
    if (!data || data.count === 0) {
      return isHovered ? COLOR_SCALE.emptyHover : COLOR_SCALE.empty
    }

    const baseIntensity = Math.log(data.count + 1) / Math.log(maxCount + 1)
    const intensity = Math.min(1, baseIntensity + (isHovered ? 0.08 : 0))
    const r = Math.round(COLOR_SCALE.low.r + (COLOR_SCALE.high.r - COLOR_SCALE.low.r) * intensity)
    const g = Math.round(COLOR_SCALE.low.g + (COLOR_SCALE.high.g - COLOR_SCALE.low.g) * intensity)
    const b = Math.round(COLOR_SCALE.low.b + (COLOR_SCALE.high.b - COLOR_SCALE.low.b) * intensity)

    return `rgb(${r}, ${g}, ${b})`
  }

  const handleClick = (geo, countryCode) => {
    onCountryClick(countryCode, geo.properties.name)
  }

  return (
    <div className="world-map">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 130,
          center: [0, 30]
        }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                // Get ISO alpha-2 code from numeric code
                const numericCode = String(geo.id).padStart(3, '0')
                const countryCode = numericToAlpha2[numericCode] || geo.properties.ISO_A2 || ''
                const isSelected = selectedCountry?.code === countryCode
                const isHighlighted = highlightedCountries.includes(countryCode)
                const count = movieData[countryCode]?.count || 0
                const tooltipText = `${geo.properties.name}: ${count} ${count === 1 ? 'movie' : 'movies'}`

                const strokeColor = isHighlighted ? COLOR_SCALE.selected : COLOR_SCALE.stroke
                const strokeWidth = isHighlighted ? 2 : 0.5

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleClick(geo, countryCode)}
                    data-tooltip-id="map-tooltip"
                    data-tooltip-content={tooltipText}
                    style={{
                      default: {
                        fill: getCountryColor(countryCode, isSelected, false),
                        stroke: strokeColor,
                        strokeWidth: strokeWidth,
                        outline: 'none',
                      },
                      hover: {
                        fill: isSelected ? COLOR_SCALE.selectedHover : getCountryColor(countryCode, false, true),
                        stroke: strokeColor,
                        strokeWidth: strokeWidth,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: COLOR_SCALE.selected,
                        stroke: strokeColor,
                        strokeWidth: strokeWidth,
                        outline: 'none',
                      },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      <Tooltip
        id="map-tooltip"
        place="top"
        className="map-tooltip"
      />
    </div>
  )
}

export default WorldMap
