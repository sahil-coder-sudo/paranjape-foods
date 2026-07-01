Paranjape Foods — Deployment Guide (Option B)

This document describes deploying the frontend to Vercel and the backend to Render or Heroku.

1) Prepare env vars

- `MONGODB_URI` — your MongoDB Atlas connection string. Example:

  `mongodb+srv://sahil:MYSECRET@paranjapefoods.vokug.mongodb.net/paranjapefoods`

  Replace `MYSECRET` with your password and URL-encode special characters.

- `PORT` — backend port (default 4000). Hosting platforms usually provide this automatically.

- `NEXT_PUBLIC_API_BASE` — (for frontend) the base URL for API calls, e.g. `https://api.example.com`.

2) Local sanity checks

```bash
# install deps
npm install

# create .env from .env.example and fill MONGODB_URI
cp .env.example .env
# edit .env to set MONGODB_URI (replace <db_password>)

# seed the DB (after setting MONGODB_URI in env)
node scripts/seed.js

# run backend
npm run dev:backend

# run frontend
npm run dev
```

3) Frontend: Deploy to Vercel

- Create a Vercel project and connect your GitHub repo.
- In Project Settings -> Environment Variables, set `NEXT_PUBLIC_API_BASE` to your backend URL.
- Push to the default branch; Vercel will build with `npm run build` and deploy.

4) Backend: Deploy to Render

- Create a new Web Service on Render (or use Heroku if you prefer).
- Connect your GitHub repo.
- Build Command: `npm install`
- Start Command: `npm run backend` (or `node server.js`)
- In Environment, add `MONGODB_URI` (your Atlas URI).

Render specifics:
- Set a health check to `https://<your-service>.onrender.com/api/health`.

5) Backend: Deploy to Heroku (alternative)

- Add the included `Procfile` to the repo:

```
web: node server.js
```
- Create a Heroku app, connect GitHub or push, then set `MONGODB_URI` in Config Vars.

6) Seeding production DB

Run locally or as a one-off job on the host (with `MONGODB_URI` set):

```bash
export MONGODB_URI="mongodb+srv://sahil:MYSECRET@paranjapefoods.vokug.mongodb.net/paranjapefoods"
node scripts/seed.js
```

7) Notes & next steps

- If your frontend needs to call the backend from the browser, ensure `NEXT_PUBLIC_API_BASE` is set in Vercel to the backend's HTTPS URL.
- I can add a `render.yaml` for Render or a GitHub Actions workflow for automated deploys.

GitHub Actions (CI/CD) for Heroku backend

- A sample workflow is included at `.github/workflows/ci-cd.yml` which:
  - builds the Next.js frontend to ensure the repo builds correctly
  - deploys the Express backend to Heroku using repository secrets

Secrets to add in GitHub (Repository -> Settings -> Secrets -> Actions):
  - `HEROKU_API_KEY` — get via `heroku auth:token`
  - `HEROKU_APP_NAME` — your Heroku app name (e.g., `my-paranjape-backend`)
  - `HEROKU_EMAIL` — your Heroku account email

If you'd like, I can also add a `render.yaml` or a GitHub Actions job to deploy the frontend to Vercel via Vercel's Git integration.
