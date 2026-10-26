'use client'
// The Risk outlook on a map: a secondary view of the same sources. Each upcoming order that leans on a
// risky route, mode, make or site is a lane, coloured by the worst trouble rate among its sources.
// Pick a source to see where it bites; pick a lane to see what it leans on. Shares the ops map's
// geometry and basemap (geo.ts), at the snapshot.
import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Map as Basemap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { RiskLane, RiskMap as RiskMapData, RiskSourceView } from '@/lib/opsmap/risk'
import { BASEMAP, WORLD, arc, boundsOf, isDark, toWorld } from './geo'
import { Icon, type IconName } from './icons'

const KIND_ICON: Record<RiskSourceView['kind'], IconName> = { route: 'route', mode: 'ferry', make: 'car', dealership: 'pin' }
const LEVEL: Record<string, { label: string; tone: string }> = {
  fine: { label: 'On track', tone: 'text-secondary' }, watch: { label: 'Watch', tone: 'text-amber' }, likely_to_slip: { label: 'Likely to slip', tone: 'text-red' },
}

// The worst shrunk trouble rate among a lane's sources, in three steps a person can tell apart.
const BANDS = [
  { min: 0.25, colour: 'var(--color-red)', label: '25% or more' },
  { min: 0.12, colour: 'var(--color-orange)', label: '12–25%' },
  { min: 0, colour: 'var(--color-amber)', label: 'under 12%' },
]
const bandOf = (heat: number) => BANDS.find((b) => heat >= b.min)!

const PANEL = 'rounded-[2px] border border-hair bg-card'
const CAPTION = 'flex items-center gap-[6px] text-[11.5px] font-bold uppercase tracking-[0.06em] [font-stretch:75%] text-tertiary'
const pct = (x: number) => `${Math.round(x * 100)}%`

export default function RiskMap({ map: data, scope, focus, setFocus, levels, cars }: {
  map: RiskMapData
  scope: 'worth' | 'all'
  focus: string | null
  setFocus: (id: string | null) => void
  levels: Record<string, string>
  cars: Record<string, string>
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const sources = useMemo(() => data.sources.filter((s) => scope === 'all' || s.dashboard), [data, scope])
  const shown = useMemo(() => new Set(sources.map((s) => s.id)), [sources])
  const lanes = useMemo(
    () => data.lanes
      .map((l) => ({ ...l, sources: l.sources.filter((id) => shown.has(id)) }))
      .filter((l) => l.sources.length)
      .map((l) => ({ ...l, heat: Math.max(...l.sources.map((id) => data.sources.find((s) => s.id === id)!.shrunk)) })),
    [data, shown],
  )
  const focused = focus ? sources.find((s) => s.id === focus) ?? null : null
  const lane = picked ? lanes.find((l) => l.ref === picked) ?? null : null

  return (
    <div className="tw grid grid-cols-[minmax(0,1fr)] gap-3 text-body lg:grid-cols-[minmax(0,1fr)_320px]">
      <MapPane data={data} lanes={lanes} focus={focused} picked={picked} pick={(ref) => setPicked(ref === picked ? null : ref)} clear={() => { setPicked(null); setFocus(null) }} />
      <aside className={`${PANEL} flex max-h-[560px] flex-col`}>
        {lane ? (
          <LaneDetail lane={lane} sources={data.sources} level={levels[lane.ref] ?? 'fine'} car={cars[lane.ref]} close={() => setPicked(null)} />
        ) : (
          <>
            <p className={`${CAPTION} border-b border-hair px-[12px] py-[9px]`}>
              <Icon name="alert" size={12} />
              Sources on the map
              <span className="ml-auto tabular-nums">{sources.length}</span>
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {sources.map((s) => {
                const on = focus === s.id
                const drawn = lanes.filter((l) => l.sources.includes(s.id)).length
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setFocus(on ? null : s.id)}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-[8px] border-b border-hair/60 px-[12px] py-[8px] text-left transition-colors ${on ? 'bg-birch shadow-[inset_2px_0_0_var(--color-label)]' : 'hover:bg-birch/60'}`}
                    >
                      <span className="size-[8px] shrink-0 rounded-full" style={{ background: bandOf(s.shrunk).colour }} />
                      <Icon name={KIND_ICON[s.kind]} size={13} className="shrink-0 text-tertiary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-label">{s.label}</span>
                        <span className="block font-mono text-[10.5px] text-tertiary">{s.k} of {s.n} had trouble · {drawn} {drawn === 1 ? 'lane' : 'lanes'}</span>
                      </span>
                      {s.elevated ? <span className="font-mono text-[10px] text-orange">look early</span> : null}
                    </button>
                  </li>
                )
              })}
              {!sources.length ? <li className="px-[12px] py-[14px] text-[12px] text-secondary">No source with a record worth showing.</li> : null}
            </ul>
            <p className="border-t border-hair px-[12px] py-[8px] text-[11px] leading-[1.5] text-tertiary">
              Pick a source to see where it bites, or a lane to see what it leans on.
              {data.unplaced ? ` ${data.unplaced} exposed ${data.unplaced === 1 ? 'order has' : 'orders have'} no city on the map.` : ''}
            </p>
          </>
        )}
      </aside>
    </div>
  )
}

function LaneDetail({ lane, sources, level, car, close }: { lane: RiskLane; sources: RiskSourceView[]; level: string; car?: string; close: () => void }) {
  const lv = LEVEL[level] ?? LEVEL.fine
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[14px] py-[12px]">
      <div className="flex items-center gap-[8px]">
        <span className="font-mono text-[16px] font-semibold text-label">{lane.ref}</span>
        <span className={`text-[11.5px] ${lv.tone}`}>{lv.label}</span>
        <button type="button" onClick={close} className="ml-auto text-tertiary hover:text-label" aria-label="Back to the sources">
          <Icon name="close" size={13} />
        </button>
      </div>
      <p className="mt-[2px] text-[12px] text-secondary">{car ? `${car} · ` : ''}{lane.from} → {lane.to}</p>
      <p className={`${CAPTION} mt-[14px]`}>Leans on</p>
      <ul className="mt-[6px] space-y-[6px]">
        {lane.sources.map((id) => {
          const s = sources.find((x) => x.id === id)!
          return (
            <li key={id} className="rounded-[2px] border border-hair px-[10px] py-[7px]">
              <p className="flex items-center gap-[6px] text-[12.5px] text-label">
                <Icon name={KIND_ICON[s.kind]} size={12} className="text-tertiary" />
                {s.label}
              </p>
              <p className="mt-[2px] font-mono text-[10.5px] text-tertiary">
                {s.k} of {s.n} past orders had trouble · about {pct(s.shrunk)} after small-sample shrinkage
              </p>
            </li>
          )
        })}
      </ul>
      <Link
        href={`/case/${lane.ref}`}
        className="mt-[14px] inline-flex w-full items-center justify-center gap-[6px] rounded-[2px] bg-ink px-[12px] py-[7px] text-[12.5px] font-semibold text-canvas hover:opacity-90"
      >
        Open the case
        <Icon name="arrow-right" size={13} />
      </Link>
    </div>
  )
}

function MapPane({ data, lanes, focus, picked, pick, clear }: {
  data: RiskMapData
  lanes: RiskLane[]
  focus: RiskSourceView | null
  picked: string | null
  pick: (ref: string) => void
  clear: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Basemap | null>(null)
  const lanesRef = useRef<SVGGElement>(null)
  const markersRef = useRef<SVGGElement>(null)
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState(false)
  const [tip, setTip] = useState<{ x: number; y: number; ref: string } | null>(null)

  // The overlay follows the camera inside MapLibre's own frame, as on the ops map.
  const sync = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const c = map.getCenter()
    const k = (512 * 2 ** map.getZoom()) / WORLD
    const [wx, wy] = toWorld([c.lng, c.lat])
    const p = map.project(c)
    const tx = p.x - k * wx
    const ty = p.y - k * wy
    lanesRef.current?.setAttribute('transform', `matrix(${k} 0 0 ${k} ${tx} ${ty})`)
    markersRef.current?.querySelectorAll<SVGGElement>('[data-wx]').forEach((el) => {
      el.setAttribute('transform', `translate(${k * Number(el.dataset.wx) + tx} ${k * Number(el.dataset.wy) + ty})`)
    })
  }, [])
  useLayoutEffect(sync)

  const allBounds = useMemo(() => boundsOf(Object.values(data.cities)), [data])

  useEffect(() => {
    let map: Basemap | null = null
    let dead = false
    import('maplibre-gl').then(({ Map, NavigationControl, setWorkerUrl }) => {
      if (dead || !box.current) return
      setWorkerUrl('/vendor/maplibre-gl-worker.mjs')
      map = new Map({
        container: box.current, style: BASEMAP[isDark() ? 'dark' : 'light'], bounds: allBounds ?? undefined,
        fitBoundsOptions: { padding: 50 }, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false,
        renderWorldCopies: false, maxZoom: 11,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
      map.on('render', sync)
      map.on('click', clear)
      map.on('error', () => { if (map && !map.isStyleLoaded()) setOffline(true) })
      mapRef.current = map
      setReady(true)
    })
    let dark: boolean | null = null
    const restyle = () => {
      const next = isDark()
      if (next === dark) return
      dark = next
      map?.setStyle(BASEMAP[next ? 'dark' : 'light'])
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const watcher = new MutationObserver(restyle)
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    media.addEventListener('change', restyle)
    return () => {
      dead = true
      watcher.disconnect()
      media.removeEventListener('change', restyle)
      map?.remove()
      mapRef.current = null
    }
    // Created once; a picked source flies the existing camera below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A picked source flies to where it bites; clearing it flies back out.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const pts = focus
      ? lanes.filter((l) => l.sources.includes(focus.id)).flatMap((l) => [data.cities[l.from], data.cities[l.to]])
      : Object.values(data.cities)
    const b = boundsOf(pts)
    if (b) map.fitBounds(b, { padding: { top: 50, bottom: 60, left: 50, right: 60 }, maxZoom: 8, duration: 900 })
  }, [focus, lanes, data, ready])

  const drawn = useMemo(() => {
    const seen = new Map<string, number>()
    return [...lanes]
      .sort((a, b) => a.heat - b.heat)
      .map((l) => {
        const key = `${l.from}|${l.to}`
        const n = seen.get(key) ?? 0
        seen.set(key, n + 1)
        return { l, a: arc(toWorld(data.cities[l.from]), toWorld(data.cities[l.to]), 0.14 + n * 0.07) }
      })
  }, [lanes, data])

  const cities = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of lanes) for (const c of [l.from, l.to]) m.set(c, (m.get(c) ?? 0) + 1)
    return m
  }, [lanes])

  const on = (l: RiskLane) => (picked ? l.ref === picked : focus ? l.sources.includes(focus.id) : true)
  const tipLane = tip ? lanes.find((l) => l.ref === tip.ref) : null

  return (
    <section ref={wrap} className={`${PANEL} relative h-[420px] overflow-hidden lg:h-[560px]`} onMouseLeave={() => setTip(null)}>
      <div className="absolute inset-0 bg-canvas"><div ref={box} className="h-full w-full" /></div>
      {ready ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" role="img" aria-label={`${lanes.length} upcoming orders that lean on a risky source`}
          onWheel={(e) => mapRef.current?.getCanvas().dispatchEvent(new WheelEvent('wheel', e.nativeEvent))}>
          <g ref={lanesRef}>
            {drawn.map(({ l, a }) => {
              const lit = on(l)
              const colour = bandOf(l.heat).colour
              return (
                <g key={l.ref} opacity={lit ? 1 : 0.12}>
                  {picked === l.ref ? <path d={a.d} fill="none" stroke={colour} strokeWidth={8} strokeOpacity={0.22} strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
                  <path d={a.d} fill="none" stroke={colour} strokeWidth={picked === l.ref ? 2.8 : 1.8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <path d={a.d} fill="none" stroke="transparent" strokeWidth={10} vectorEffect="non-scaling-stroke" pointerEvents="stroke" className="cursor-pointer"
                    onMouseMove={(e) => { const r = wrap.current?.getBoundingClientRect(); if (r) setTip({ x: e.clientX - r.left, y: e.clientY - r.top, ref: l.ref }) }}
                    onMouseLeave={() => setTip(null)}
                    onClick={(e) => { e.stopPropagation(); pick(l.ref) }} />
                </g>
              )
            })}
          </g>
          <g ref={markersRef}>
            {[...cities.entries()].map(([name, n]) => {
              const [x, y] = toWorld(data.cities[name])
              const r = 2.6 + Math.sqrt(n) * 1.5
              return (
                <g key={name} data-wx={x} data-wy={y}>
                  <circle r={r} fill="var(--color-card)" stroke="var(--color-secondary)" strokeWidth={1.4} />
                  <circle r={1.6} fill="var(--color-label)" />
                  {n >= 2 ? (
                    <text x={r + 5} y={3.5} className="select-none font-mono" fontSize={10.5} fill="var(--color-secondary)" paintOrder="stroke" stroke="var(--color-canvas)" strokeWidth={3}>{name}</text>
                  ) : null}
                </g>
              )
            })}
          </g>
        </svg>
      ) : null}

      <div className="absolute left-[10px] top-[10px] z-[1] flex flex-wrap items-center gap-[8px]">
        {focus ? (
          <button type="button" onClick={clear} className="inline-flex items-center gap-[5px] rounded-[2px] border border-hair bg-card/90 px-[9px] py-[5px] text-[12px] text-label backdrop-blur">
            {focus.label}
            <Icon name="close" size={11} />
          </button>
        ) : (
          <span className="rounded-[2px] border border-hair bg-card/90 px-[9px] py-[5px] text-[12px] text-secondary backdrop-blur">
            {lanes.length} upcoming {lanes.length === 1 ? 'order leans' : 'orders lean'} on a risky source
          </span>
        )}
        {offline ? <span className="rounded-[2px] bg-card/90 px-[8px] py-[4px] font-mono text-[10.5px] text-orange">basemap offline · lanes still drawn</span> : null}
      </div>

      <ul className="pointer-events-none absolute bottom-[10px] left-[10px] z-[1] flex flex-wrap gap-x-[12px] gap-y-[4px] rounded-[2px] bg-card/80 px-[9px] py-[5px] backdrop-blur">
        <li className="text-[10.5px] text-tertiary">Worst trouble rate on the lane:</li>
        {BANDS.map((b) => (
          <li key={b.label} className="inline-flex items-center gap-[5px] text-[10.5px] text-secondary">
            <span className="h-[2px] w-[14px] rounded-full" style={{ background: b.colour }} />
            {b.label}
          </li>
        ))}
      </ul>

      {tip && tipLane ? (
        <div className="pointer-events-none absolute z-[2] max-w-[240px] rounded-[2px] border border-sand bg-birch px-[9px] py-[6px] text-[11.5px] leading-[1.45] shadow-[var(--shadow-2)]"
          style={{ left: tip.x + 14, top: tip.y + 12 }}>
          <p className="font-mono text-label">{tipLane.ref}</p>
          <p className="text-secondary">{tipLane.from} → {tipLane.to}</p>
          <p style={{ color: bandOf(tipLane.heat).colour }}>{tipLane.sources.length} risky {tipLane.sources.length === 1 ? 'source' : 'sources'} · up to {pct(tipLane.heat)}</p>
        </div>
      ) : null}
    </section>
  )
}
