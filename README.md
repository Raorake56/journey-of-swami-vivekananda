# Journey of Swami Vivekananda

An interactive educational atlas of Swami Vivekananda’s life and travels, from 12 January 1863 to 4 July 1902.

The website includes 257 sourced events, 184 places, 153 schematic journey connections, and a nine-chapter Indian English audio guide with a synchronised transcript. Official Belur Math accounts take priority when historical accounts differ. Uncertain dates and route geometry are labelled explicitly.

## Run locally

```sh
python -m http.server 8000 --directory dist
```

Open http://localhost:8000. No JavaScript build, database, environment variables or API keys are required.

## Deploy on Vercel

Import this repository as a new Vercel project named `journey-of-swami-vivekananda`. Keep the repository root as the Root Directory. The committed `vercel.json` selects the Other framework preset, skips installation and building, and publishes `dist`.

For the Vercel CLI, first authenticate, then link this directory to that project and deploy:

```sh
vercel link --project journey-of-swami-vivekananda
vercel deploy --prod
```

## Edit and verify

The reviewed historical dataset is `dist/data.json`. The original one-time assembly script is intentionally excluded: it predates the official source review and would overwrite corrections. Edit the reviewed records directly and keep citations, dates, route endpoints and transcript passages consistent.

```sh
python validate-data.py
python validate-narration.py
```

Audio verification needs `ffprobe`. To regenerate narration, install `requirements-audio.txt` and FFmpeg, then run `python generate-narration.py` for all chapters, or pass the affected chapter IDs, for example `python generate-narration.py formation india`. The bundled MP3 files play without a speech service request from visitors.

## Historical method and credits

See `dist/sources.html` for date precision, source decisions, route conventions, image attribution and map boundary licensing. See `ATTRIBUTION.md` for bundled third-party assets. This is an independent educational project and does not imply endorsement by Belur Math.
