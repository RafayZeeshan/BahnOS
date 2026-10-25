// Map geometry shared by the ops map and the risk map (ADR-017): the basemap for the theme, and the
// Web Mercator "world" units the SVG overlay is drawn in.
import type { LngLatBoundsLike } from 'maplibre-gl'

// CARTO's dark basemap without place names: the lanes carry the labels that
// matter, and the streets underneath only need to say where things are.
export const BASEMAP = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
}
// BahnOS follows the system theme unless the sidebar toggle set one.
export function isDark(): boolean {
  const set = document.documentElement.dataset.theme
  return set ? set === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Two decimals is finer than a pixel and keeps re-renders cheap to diff.
export const r2 = (n: number) => Math.round(n * 100) / 100

// The overlay is drawn once in Web Mercator "world" units (the map's pixel
// space at zoom 6) and the camera is applied as a transform. With no rotation
// or pitch, MapLibre's camera is exactly a scale plus a shift of these units.
export const WORLD = 512 * 2 ** 6

export function toWorld([lon, lat]: [number, number]): [number, number] {
  const s = Math.sin((lat * Math.PI) / 180)
  return [
    r2(((lon + 180) / 360) * WORLD),
    r2((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD),
  ]
}

/** The box around a set of [lon, lat] points. */
export function boundsOf(points: [number, number][]): LngLatBoundsLike | null {
  if (!points.length) return null
  const lons = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

export type Arc = { d: string; at: (t: number) => [number, number] }

/** A gentle bow between two cities, so lanes sharing a corridor stay apart. */
export function arc(a: [number, number], b: [number, number], bend: number): Arc {
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const cx = r2(mx - dy * bend)
  const cy = r2(my + dx * bend)
  return {
    d: `M${a[0]},${a[1]} Q${cx},${cy} ${b[0]},${b[1]}`,
    at: (t) => [
      r2((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * cx + t * t * b[0]),
      r2((1 - t) ** 2 * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]),
    ],
  }
}
