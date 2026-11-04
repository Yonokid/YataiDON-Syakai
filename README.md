# yataidon-syakai

Web frontend (Vue 3 + Vite + TypeScript) for YataiDON

The backend API is not included in this repository. Please contact me if you need an API key for access

## Setup

Requires [Bun](https://bun.sh).

```sh
bun install
cp .env.example .env
bun run dev
```

## Assets

`public/costumes/` is gitignored.
`costume_names.json`, `costume_icon/`, `costume_head_icon/`, `costume_body_icon/`, `acce/` are optionally required.
The Chara3D preview also needs `head/`, `body/`, `cos/`, `animations.glb` and `face/face_000000.png`. All of these come from `Skins/PyTaikoGreen/Models` in YataiDON.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server with hot reload |
| `bun run build` | Type-check and build to `dist/` |
| `bun run preview` | Serve the production build |
| `node scripts/generate-versions.mjs [path]` | Regenerate `src/data/versions.json` from [ESE-Version-Sorting](https://ese.tjadataba.se/Yonokid/ESE-Version-Sorting) |

## License

[GPL-3.0](LICENSE)
