# Heroku Deployment Guide — Paranjape Foods

This guide explains how to deploy Paranjape Foods to your Heroku Dyno automatically via **GitHub Actions**.

---

## 1. Prerequisites on Heroku

Ensure your Heroku app has the required environment variables (Config Vars) set in the **Heroku Dashboard** (`Settings` -> `Config Vars`) or via the Heroku CLI:

```bash
# Set MongoDB Atlas URI
heroku config:set MONGODB_URI="mongodb+srv://sahil:<password>@paranjapefoods.vokug.mongodb.net/paranjape_foods" --app your-heroku-app-name

# Set Staff & Rider PINs
heroku config:set MANAGER_PASSCODE="your_manager_passcode" --app your-heroku-app-name
heroku config:set DELIVERY_PASSCODE="your_delivery_passcode" --app your-heroku-app-name

# Set Google Geocoding Key (for server address validation)
heroku config:set GOOGLE_GEOCODING_API_KEY="your_geocoding_api_key" --app your-heroku-app-name
```

*(Note: `PORT` is assigned automatically by Heroku at runtime; do not hardcode it).*

---

## 2. Obtain Your Heroku API Key

You need an authorization token so GitHub Actions can authenticate with Heroku:

### Option A: Via Heroku CLI
```bash
heroku auth:token
```
Copy the generated token string.

### Option B: Via Heroku Dashboard
1. Go to [https://dashboard.heroku.com/account](https://dashboard.heroku.com/account).
2. Scroll to the **API Key** section.
3. Click **Reveal** and copy the key.

---

## 3. Configure GitHub Secrets

In your GitHub repository:
1. Navigate to **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret** and add the following:

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `HEROKU_API_KEY` | Token from step 2 (`heroku auth:token`) | `01234567-89ab-cdef-...` |
| `HEROKU_APP_NAME` | The exact name of your Heroku app | `my-paranjape-backend` |

---

## 4. How the GitHub Action Works

The workflow located in [`.github/workflows/ci-cd.yml`](file:///.github/workflows/ci-cd.yml) runs automatically whenever code is pushed to `main`:

1. **Build & Test Job:**
   - Checks out the codebase.
   - Installs dependencies using Node 20.
   - Compiles the frontend (`npm run build --workspace=frontend`) to catch any build errors before deployment.
2. **Deploy Job:**
   - Connects to your Heroku Git remote using the authenticated endpoint:
     `https://heroku:${{ secrets.HEROKU_API_KEY }}@git.heroku.com/${{ secrets.HEROKU_APP_NAME }}.git`
   - Pushes the branch to Heroku, triggering a Dyno release.
3. **Execution:**
   - Heroku reads [`Procfile`](file:///Procfile) which executes:
     ```text
     web: node backend/server.js
     ```
   - Dyno boots the Express backend listening on `$PORT`.

---

## 5. Verifying Deployment & Logs

Once GitHub Actions finishes successfully:

```bash
# Check Dyno status
heroku ps --app your-heroku-app-name

# Tail live application logs (SSE streams, DB connection, incoming requests)
heroku logs --tail --app your-heroku-app-name
```
