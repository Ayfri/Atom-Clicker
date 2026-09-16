# ⚛️ Atom Clicker

Welcome to Atom Clicker, an engaging incremental game where you'll build your own atomic empire! Start small with individual atoms and work your way up to cosmic structures.

[![GitHub](https://img.shields.io/github/stars/Ayfri/Atom-Clicker?style=social)](https://github.com/Ayfri/Atom-Clicker)
[![Discord](https://img.shields.io/discord/493478524133572610?style=flat&logo=discord&logoColor=white&label=discord&color=5865F2)](https://discord.ayfri.com)
[![Players](https://img.shields.io/badge/dynamic/json?label=Players&query=$.totalUsers&url=https://atom-clicker.ayfri.com/api/stats&color=blue)](https://atom-clicker.ayfri.com)

🎮 [Play Now](https://atom-clicker.ayfri.com) | 💬 [Discord](https://discord.ayfri.com)

![Atom Clicker Gameplay](static/ingame-screenshot.png)
![Atom Clicker Gameplay](static/ingame-screenshot2.png)
![Atom Clicker Gameplay](static/ingame-screenshot3.png)

## 🎮 How to Play

1. **Click the Atom:** Start by clicking the central atom to generate your first atoms.
2. **Buy Buildings:** Use your atoms to purchase buildings that automatically generate more atoms for you.
3. **Upgrade:** Enhance your buildings and clicking power through the upgrades menu.
4. **Unlock Skills:** Spend your earned points in the Skill Tree to gain massive permanent boosts.
5. **Reset for Power:** When progress slows down, perform a reset to gain powerful currencies like Protons and Electrons to further boost your empire.

## ⚛️ Features

### Core Mechanics
- 🖱️ Click to generate atoms
- 🏗️ Build and manage various structures:
  - From tiny molecules to massive cosmic entities
  - Each structure with unique production rates
  - Level up your buildings to increase their efficiency

### Progression Systems
- 🌳 Extensive Skill Tree
  - Unlock powerful multipliers
  - Enhance your clicking power
  - Boost your production capabilities
  - Unlock automation features

- 🎮 Multiple Reset Layers
  - Each layer provides powerful bonuses
  - Strategic decisions on when to reset
  - Permanent progression rewards

### Advanced Features
- ⚡ Power-up System
  - Random power-ups appear during gameplay
  - Stack multiple effects
  - Collect **Higgs Bosons** for permanent bonuses
  - Upgrade their duration and effectiveness

- 🤖 Automation
  - Auto-buy buildings
  - Auto-upgrade systems
  - Optimize your production

- 🟣 Photon Realm
  - Unlock a mysterious gameplay dimension with interactive violet circles
  - Discover rare **Excited Photons** for exotic upgrades

- ☢️ Radiation Realm
  - Simulate and control a nuclear reactor: manage mass, control rods and CPM
  - Unlock reactor upgrades for passive mass regeneration and better output
  - Boost your empire through a radiation multiplier

- ✨ Quarks & Daily Quests
  - Earn Quarks from achievements and daily quests
  - Spend them in the Quark Shop for permanent upgrades
  - Complete rotating daily quests for bonus rewards

### Social Features
- 📊 Global Leaderboard
- 🏆 Achievement System with claimable rewards
- 🔒 Secure Authentication

## 🚀 Getting Started

1. Install dependencies:
```bash
bun install
```

2. Start the development server:
```bash
bun dev
```

3. Build for production:
```bash
bun run build
```

### 🗄️ Local Supabase

The backend can run entirely on your machine (requires Docker). The local stack only
starts Postgres, PostgREST, Auth and Studio, everything else is disabled in
`supabase/config.toml`.

```bash
bun db:start    # start the local stack, prints the API URL and keys
bun db:status   # show URLs and keys again
bun db:reset    # recreate the database from supabase/migrations + seed.sql
bun db:types    # regenerate src/lib/types/supabase.ts from the local schema
bun db:stop     # stop the containers
```

Copy `.env.example` to `.env` and point `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` at the values printed by
`bun db:start`. OAuth providers are off locally, create a test user from Studio
(`http://127.0.0.1:54323`) instead.

## 🛠️ Built With

- **Framework:** [SvelteKit](https://kit.svelte.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [TailwindCSS](https://tailwindcss.com/)
- **Graphics Engine:** HTML5 Canvas 2D
- **Backend & Auth:** [Supabase](https://supabase.com/)
- **Icons:** [Lucide Icons](https://lucide.dev)
- **Flow Diagrams:** [Svelte Flow](https://svelteflow.dev)

## 🌐 Deployment

This project is optimized for [Cloudflare Workers](https://workers.cloudflare.com/).

```bash
# Build for production
bun run build
```

The build output will be in the `.svelte-kit/cloudflare` directory, ready to be deployed.

## 📝 License
This project is open source and available under the [GNU GPLv3 License](LICENSE).

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Ayfri/Atom-Clicker/issues).
