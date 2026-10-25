"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { use } from "react"
import { AppFrame } from "../../components/app-frame"
import { CasePane } from "../../components/cr/case-pane"
import { useKeys } from "../../components/cr/use-keys"

export default function CasePage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params)
  const router = useRouter()
  useKeys({ Escape: () => router.push("/") })
  return <AppFrame section="today">
    <main>
      <nav className="crumb" aria-label="Breadcrumb" style={{ maxWidth: 920, margin: "0 auto", width: "100%" }}>
        <Link href="/">Today</Link><span>/</span><span className="mono">{ref}</span><span style={{ marginLeft: "auto" }}><kbd>Esc</kbd> back</span>
      </nav>
      <CasePane reference={decodeURIComponent(ref)} full />
    </main>
  </AppFrame>
}
