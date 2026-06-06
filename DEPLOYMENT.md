# Deploying EduAI

Backend → **Render** · Frontend → **Vercel** · Database → **MongoDB Atlas**

The repo is a monorepo. Render deploys from `backend/`, Vercel from `frontend/`.

---

## 0. Prerequisites (do this first)

1. **Push the repo to GitHub** (Render and Vercel both deploy from a Git remote).
2. **MongoDB Atlas** — create a free cluster at <https://www.mongodb.com/atlas>:
   - Create a database user (username + password).
   - Network Access → add `0.0.0.0/0` (allow from anywhere) so Render can connect.
   - Copy the connection string:
     `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/edtech_db?retryWrites=true&w=majority`
3. **Gemini API key** — <https://aistudio.google.com/app/apikey>.

---

## 1. Backend on Render

The repo includes [`render.yaml`](render.yaml), so you can deploy as a **Blueprint**:

1. Render dashboard → **New +** → **Blueprint** → connect this GitHub repo.
2. Render reads `render.yaml` and creates the `eduai-backend` web service.
3. Fill in the secret env vars when prompted (or under **Environment** afterwards):
   | Key | Value |
   |-----|-------|
   | `MONGO_URI` | your Atlas connection string |
   | `GEMINI_API_KEY` | your Gemini key |
   | `FRONTEND_URL` | leave blank for now — fill after step 2 |
   `JWT_SECRET` is auto-generated; `NODE_ENV`, `PUPPETEER_CACHE_DIR`, `JWT_EXPIRES_IN` are preset.
4. Deploy. First build is slow (~5–8 min) because Puppeteer downloads Chromium.
5. Note your backend URL, e.g. `https://eduai-backend.onrender.com`.
   Verify: open `https://eduai-backend.onrender.com/api/health` → `{"success":true,...}`.

> **Prefer manual setup?** New Web Service → root dir `backend`,
> build `npm install --include=dev && npm run build`, start `npm start`,
> health check path `/api/health`, then add the env vars above + `PUPPETEER_CACHE_DIR=/opt/render/project/src/backend/.puppeteer-cache`.

> **Free tier note:** the service sleeps after ~15 min idle; the first request after
> sleeping takes ~30–50 s to wake.

---

## 2. Frontend on Vercel

1. Vercel dashboard → **Add New** → **Project** → import this GitHub repo.
2. **Root Directory** → set to `frontend`. Framework auto-detects as **Next.js**.
3. Add an environment variable:
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_TARGET` | `https://eduai-backend.onrender.com` (your Render URL) |
4. Deploy. Note your frontend URL, e.g. `https://eduai.vercel.app`.

`/api/*` requests from the app are rewritten server-side to the Render backend
(see [next.config.ts](frontend/next.config.ts)), so the browser only ever talks to Vercel.

---

## 3. Link them back together

1. In **Render** → `eduai-backend` → Environment, set
   `FRONTEND_URL = https://eduai.vercel.app` (your Vercel URL) and redeploy.
   This sets the CORS allow-origin on the backend.
2. Done. Visit your Vercel URL and log in.

---

## Redeploys

Both services have auto-deploy on push to the default branch. Just `git push`.

## Known limitations on free tiers

- **Ephemeral disk** — `backend/uploads/` and `backend/generated_papers/` are wiped
  on every restart/redeploy. Generated PDFs are downloaded immediately so this is fine,
  but durable file uploads would need cloud storage (S3/Cloudinary) later.
- **Cold starts** — Render free web services sleep when idle (see note above).
