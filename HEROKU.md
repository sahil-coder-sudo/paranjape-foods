Heroku deployment guide — Paranjape Foods backend

1) Install Heroku CLI

```bash
# macOS (Homebrew)
brew tap heroku/brew && brew install heroku
# or see https://devcenter.heroku.com/articles/heroku-cli
```

2) Login and create app

```bash
heroku login
# create an app (replace my-app-name with a unique name)
heroku create my-paranjape-backend
```

3) Configure environment variables

```bash
# set MongoDB URI
heroku config:set MONGODB_URI="mongodb+srv://sahil:MYSECRET@paranjapefoods.vokug.mongodb.net/paranjapefoods" --app my-paranjape-backend
# optionally set PORT (Heroku provides a port automatically)
```

4) Deploy (git push)

```bash
git push heroku main
```

5) Obtain Heroku API Key (for GitHub Actions)

```bash
heroku auth:token
```

6) Add GitHub secrets

In the GitHub repository Settings -> Secrets -> Actions add:
- `HEROKU_API_KEY` — the value from `heroku auth:token`
- `HEROKU_APP_NAME` — the Heroku app name (e.g., `my-paranjape-backend`)
- `HEROKU_EMAIL` — the email used for the Heroku account

The included workflow `.github/workflows/ci-cd.yml` will build the frontend and deploy the backend to Heroku when you push to `main`.