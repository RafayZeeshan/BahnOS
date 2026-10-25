import type { NextConfig } from "next"
import { loadRootEnv } from "./lib/env"

loadRootEnv()

const config: NextConfig = { devIndicators: false }

export default config
