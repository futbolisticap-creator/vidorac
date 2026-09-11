# Vidorac Public Beta

Vidorac is a focused local web application for analyzing and downloading public media from YouTube, TikTok, Instagram, X/Twitter, Reddit, and Facebook. It connects a Next.js interface to FastAPI, uses yt-dlp for video/audio, gallery-dl for supported image posts, galleries, and mixed posts, and delegates safe merging and MP3 conversion to FFmpeg.

## Project structure

```text
Clipora/
├── frontend/   # Next.js, Tailwind CSS, and TypeScript
├── backend/    # Python and FastAPI
├── README.md
└── .gitignore
```

The project directory may still be named `Clipora` locally while the product and interface use the Vidorac brand.

## Requirements

- Node.js 20.9 or newer
- npm
- Python 3.10 or newer
- FFmpeg and ffprobe available in `PATH` for merged video streams and MP3 conversion

## Supported media

- YouTube, TikTok, Instagram, X/Twitter, Reddit, and Facebook videos through yt-dlp
- Public Instagram, TikTok, X/Twitter, Reddit, and Facebook image posts through gallery-dl when the platform exposes them anonymously
- Single images in their original format when supported
- Image carousels with individual, selected, or complete ZIP downloads
- Supported mixed posts with individual media or complete ZIP downloads

Only individual posts are accepted. Profiles, timelines, subreddits, feeds, hashtags, groups, albums, and account collections are rejected. Gallery downloads are limited to 50 items and 1 GB total. No cookies, private sessions, or login data are used.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## Run the backend

From a second PowerShell window:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The health endpoint is available at http://localhost:8000/api/health and returns:

```json
{"status":"ok"}
```

## Supported public media

- YouTube, TikTok, Instagram, X/Twitter, Reddit, and Facebook video through yt-dlp
- Instagram single-image, carousel, and mixed posts through gallery-dl when anonymously accessible
- TikTok photo posts and slideshows through gallery-dl when anonymously accessible
- X/Twitter image tweets, multi-image tweets, and mixed tweets when gallery-dl exposes the complete public post
- Reddit image posts and galleries, plus mixed posts when gallery-dl exposes them
- Facebook public image posts, multi-image posts, and mixed posts when gallery-dl can access them without login
- Mixed image/video post archives when gallery-dl exposes every item reliably

Vidorac accepts individual post/video URLs only. Profiles, timelines, subreddits, feeds, hashtags, groups, albums, private content, and login-dependent posts are rejected. Galleries are limited to 50 items and 1 GB total, packaged with safe flat filenames, and use the same one-time native browser download and temporary-file cleanup flow as video.

Accepted URL families include X/Twitter status links; Reddit post, gallery, short, and direct-video links; and public Facebook post, photo, watch, video, Reel, shared-post, shared-video, or `fb.watch` links. Support still depends on the current public behavior of each platform and the installed extractors.

Vidorac checks ambiguous post URLs with gallery-dl so it can see every ordered image/video item. A lone video falls through to yt-dlp, preserving the quality and MP3 selectors. Obvious video routes such as YouTube videos, Instagram Reels, TikTok videos, Facebook Reels/watch links, and direct `v.redd.it` URLs go to yt-dlp first; gallery-dl remains the safe fallback when video analysis does not apply.

## Analyze a public URL

With both services running, submit a supported public URL in the Vidorac interface or call the API directly:

```powershell
$body = @{ url = "https://www.youtube.com/watch?v=VIDEO_ID" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/analyze" -ContentType "application/json" -Body $body
```

The API returns only controlled metadata: title, thumbnail, duration, uploader, platform, original page URL, maximum available height, and the quality options available for that item. When yt-dlp reports enough data, those options also include an approximate size. Analysis does not download media.

## Download media

After analyzing a URL in the interface, choose Best Quality, Best MP4, a resolution preset, or MP3. Best Quality keeps the highest real source quality even when that means MKV with AV1/Opus. Best MP4 first looks for the highest H.264 video plus AAC/M4A audio combination and merges it as MP4; if that exact combination is unavailable, it follows controlled MP4 fallbacks without upscaling. The interface reports the selected resolution, container, and video codec before download when the extractor provides them.

For image and mixed carousels, analyze returns a safe ordered item list for previews. The browser sends only the original post URL and zero-based item indices; the backend resolves the post again, validates every index, and downloads one item, a selected ZIP, or the complete ZIP. It never trusts a direct CDN URL supplied by the browser.

Vidorac prepares every file in an isolated operating-system temporary directory and returns a random, one-time `download_id`. The browser then starts a native download from `GET /api/download/{download_id}`; it does not buffer the complete file as a JavaScript Blob. The temporary directory is removed after the response completes. Choosing **Download again** always prepares a new file and creates a new one-time ID.

You can also test the endpoint from PowerShell:

```powershell
$body = @{
  url = "https://www.youtube.com/watch?v=VIDEO_ID"
  quality = "720"
} | ConvertTo-Json

$prepared = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/download/prepare" `
  -ContentType "application/json" `
  -Body $body

Invoke-WebRequest `
  -Uri "http://127.0.0.1:8000/api/download/$($prepared.download_id)" `
  -OutFile ".\vidorac-test.mp4"
```

For MP3, change `quality` to `"mp3"` and the output filename to `vidorac-test.mp3`.

Prepared downloads expire after 15 minutes and are single-use. Expired, delivered, failed, and missing temporary files are removed automatically. The in-memory registry is cleared when the backend shuts down normally.

### Local safety limits

- Maximum duration: 3 hours
- Maximum download size: 1 GB
- Playlists, private content, authentication, cookies, DRM bypasses, and geographic bypasses are not supported

The file-size limit is checked using yt-dlp metadata when available and while bytes are written. If a remote source does not report its size in advance, the download is stopped once the temporary data exceeds the limit.

## Updating yt-dlp

From the `backend` folder, update yt-dlp inside Vidorac's existing virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pip install -U "yt-dlp[default,curl-cffi]"
```

Check the installed version with:

```powershell
.\.venv\Scripts\python.exe -m yt_dlp --version
```

To confirm that browser impersonation support is available without hard-coding a browser version:

```powershell
.\.venv\Scripts\python.exe -m yt_dlp --list-impersonate-targets
```

Vidorac does not update yt-dlp automatically. Run these commands manually when a supported platform changes its extractor behavior. TikTok support depends on its current public behavior and the upstream yt-dlp extractor; Vidorac uses no personal cookies or accounts and reports a clean temporary error instead of applying brittle scraping workarounds.

During local development, sanitized extractor diagnostics are included for the **Copy technical error** action. Set `VIDORAC_ENV=production` before starting FastAPI in a production environment to omit that field from API responses. The legacy `CLIPORA_ENV` name remains accepted for compatibility with existing local setups. Technical diagnostics never include cookies, request headers, tokens, local paths, or stack traces.

## Free Beta Deployment

Vidorac's free public beta uses two independent services:

```text
Cloudflare Pages (static frontend)
                ↓ HTTPS API requests
Render Free Web Service (FastAPI Docker backend)
```

The frontend is a Next.js static export. `npm run build` creates `frontend/out/`; it does not require a Node.js server, Cloudflare Functions, or Cloudflare Workers. The backend runs separately as a single-worker Docker service on Render so in-memory download IDs remain consistent.

### Live public beta

- Frontend: `https://vidorac.pages.dev`
- Backend: `https://vidorac-api.onrender.com`
- Health check: `https://vidorac-api.onrender.com/api/health`
- Support: `https://ko-fi.com/vidorac`

The frontend is hosted as a static Cloudflare Pages project and the backend is a Render Free web service. Render only allows the exact production origin `https://vidorac.pages.dev` through CORS.

### Environment variables

Local frontend configuration belongs in `frontend/.env.local`, which is ignored by Git:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPPORT_URL=https://ko-fi.com/vidorac
```

Cloudflare Pages must define both public variables using the real Render URL:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://<real-render-service>.onrender.com
NEXT_PUBLIC_SUPPORT_URL=https://ko-fi.com/vidorac
```

The frontend deliberately fails fast when `NEXT_PUBLIC_API_BASE_URL` is missing or malformed, preventing a public build that silently calls localhost. The checked-in example documents the key, while each local or hosted environment supplies its own value.

Render uses:

```dotenv
VIDORAC_ENV=production
VIDORAC_ALLOWED_ORIGINS=https://<real-cloudflare-project>.pages.dev
VIDORAC_MAX_CONCURRENT_JOBS=1
```

`VIDORAC_ALLOWED_ORIGINS` accepts a comma-separated list of exact HTTP(S) origins when both a Pages URL and a future custom domain are required. Wildcards, credentials, paths, queries, and fragments are rejected. If the variable is absent locally, only `http://localhost:3000` and `http://127.0.0.1:3000` are allowed.

### Deploy the backend to Render Free

1. Push this repository to a private GitHub repository named `vidorac` on the `main` branch.
2. In Render, choose **New + → Blueprint** and connect the repository.
3. Select the root `render.yaml`. Confirm the `vidorac-api` service uses the **Free** plan before applying it.
4. When prompted for `VIDORAC_ALLOWED_ORIGINS`, enter the exact Pages origin. For the first deployment, if the Pages URL does not exist yet, enter the expected Pages project URL and replace it with the URL Cloudflare actually assigns before production testing.
5. After deployment, copy the real `https://…onrender.com` service URL and verify `GET /api/health` returns `{"status":"ok"}`.

The Docker image contains Python, the pinned stable `yt-dlp[default,curl-cffi]`, gallery-dl, FFmpeg/ffprobe, and Deno. Deno is included because current yt-dlp YouTube extraction discovers it as the available JavaScript challenge runtime. The container starts Uvicorn on Render's `$PORT`, binds to `0.0.0.0`, and uses one worker.

To redeploy after a code change, push to `main`; Render's Blueprint enables automatic deploys from commits. For an environment-only change such as the final CORS origin, update the variable in **Render Dashboard → vidorac-api → Environment**, save it, and choose **Manual Deploy → Deploy latest commit** if Render does not restart automatically.

### Deploy the frontend to Cloudflare Pages Free

1. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git**.
2. Select the private `vidorac` repository and production branch `main`.
3. Use project name `vidorac`, root directory `frontend`, build command `npm run build`, and output directory `out`.
4. Choose the **Next.js (Static HTML Export)** framework preset when offered.
5. Add `NEXT_PUBLIC_API_BASE_URL` with the real Render URL and `NEXT_PUBLIC_SUPPORT_URL=https://ko-fi.com/vidorac` under production environment variables.
6. Deploy on the Cloudflare Pages Free plan. No Functions or Workers are required.
7. Copy the actual `https://…pages.dev` URL, replace `VIDORAC_ALLOWED_ORIGINS` in Render with that exact origin, and restart the backend.

Because `NEXT_PUBLIC_*` values are embedded at build time, changing the Render URL requires a new Cloudflare Pages deployment. Pushes to `main` trigger a new build; an environment-only change can be applied with **Deployments → Retry deployment** after updating the variable.

### Free-tier operational notes

- Render may put the service to sleep. The first analysis after inactivity can take longer while it wakes; the existing loading state remains visible and the frontend does not impose a short artificial timeout.
- During that cold start, Analyze changes from its normal loading state to **Starting Vidorac…** after 3 seconds, **Almost ready…** after 15 seconds, and a longer-wait message after 45 seconds. Production requests time out after 120 seconds and can be retried with the same URL without reloading the page. Any real HTTP response cancels these waiting states immediately so platform errors are only classified from an actual backend response.
- Prepared downloads and uploads use isolated operating-system temporary directories. Files are removed after delivery, on failure, when their 15-minute registry entry expires during registry activity, and on a normal shutdown. Render's ephemeral filesystem is appropriate and no persistent disk, database, or Redis is required.
- `VIDORAC_MAX_CONCURRENT_JOBS=1` serializes download preparation and video processing in production, so multiple FFmpeg jobs cannot run simultaneously on the free instance. URL analysis remains responsive and local development defaults to two job slots.
- A forced container termination can interrupt cleanup, but Render discards the service's ephemeral filesystem when the instance is replaced. There is no durable storage growth across instances.

### Pre-deployment checks

Run these checks before deploying:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npm ci
npm run lint
npx tsc --noEmit
npm run build
Test-Path .\out\index.html
```

The final command must return `True`. Docker Desktop can validate the production container locally with `docker build --tag vidorac-backend:local .` from the `backend` directory, followed by a container run that supplies `PORT`, `VIDORAC_ENV`, `VIDORAC_ALLOWED_ORIGINS`, and `VIDORAC_MAX_CONCURRENT_JOBS`.
