"use client"

import { useState } from "react"
import type { CallView } from "@/lib/control/case"
import { fmtClock } from "@/lib/present/time"
import { Icon } from "../icons"

// A recorded call in the thread: the transcript, and a Play button that reads it aloud with the browser's
// own speech engine. No audio files, no keys, nothing leaves the machine.
export function CallItem({ call }: { call: CallView }) {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window

  function play() {
    if (!canSpeak) return
    const synth = window.speechSynthesis
    if (playing) { synth.cancel(); setPlaying(false); return }
    const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"))
    call.transcript.forEach((turn, i) => {
      const u = new SpeechSynthesisUtterance(turn.text)
      u.voice = voices[turn.speaker === "agent" ? 0 : Math.min(1, voices.length - 1)] ?? null
      u.rate = 1.05
      if (i === call.transcript.length - 1) u.onend = () => setPlaying(false)
      synth.speak(u)
    })
    setPlaying(true)
  }

  return <div className="call">
    <div className="call-actions">
      {canSpeak && <button type="button" className="btn btn-sm" onClick={play}><Icon name="phone" size={13} />{playing ? "Stop" : "Play the call"}</button>}
      <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>
        Transcript<Icon name="chevron" size={12} className="chev" />
      </button>
      <span className="badge">Recorded call</span>
    </div>
    {open && <ol className="call-transcript">{call.transcript.map((t, i) => <li key={i} className={`turn turn-${t.speaker}`}>
      <span className="turn-who">{t.speaker === "agent" ? "BahnBot (AI)" : t.speaker === "driver" ? "Driver" : call.who}</span>
      <span className="num muted">{fmtClock(t.at)}</span>
      <p>{t.text}</p>
    </li>)}</ol>}
  </div>
}
