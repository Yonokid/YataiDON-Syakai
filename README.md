# yataidon-syakai

Web frontend (Vue 3 + Vite + TypeScript) for YataiDON

The backend API is not included in this repository. Please contact me if you need an API key for access

## Setup

Requires [Bun](https://bun.sh).

```sh
bun install
cp .env.example .env   # set VITE_API_BASE_URL to your backend
bun run dev
```

## Assets

`public/costumes/` is gitignored. Supply your own: `costume_names.json` plus `costume_icon/`, `costume_head_icon/` and `costume_body_icon/` PNGs from the skin.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Type-check and build to `dist/` |
| `bun run preview` | Serve the production build |
| `node scripts/generate-versions.mjs [path]` | Regenerate `src/data/versions.json` from [ESE-Version-Sorting](https://ese.tjadataba.se/Yonokid/ESE-Version-Sorting) |

## License

[GPL-3.0](LICENSE)
