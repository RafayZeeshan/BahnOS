import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { Providers } from "./ui/kit"
import "@fontsource-variable/archivo/wdth.css"
import "./globals.css"
import "./ui/theme.css"

export const metadata: Metadata = {
  title: { default: "BahnOS", template: "%s · BahnOS" },
  description: "BahnOS: where Bahn's operations team and BahnBot work through what needs a person.",
}

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#111111" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }],
  width: "device-width",
  initialScale: 1,
}

// Applies a saved light or dark choice before first paint, so the page never flashes the other theme.
const THEME_SCRIPT = `try{var t=localStorage.getItem("cr.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Archivo and Geist Mono are bundled with the app, so the type works offline.
  return (
    <html lang="en" className={GeistMono.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body><Providers>{children}</Providers></body>
    </html>
  )
}
