# Vercel Deployment Commands

## 1. Firebase Environment Files

Create or update `.env.production`:

```env
VITE_FIREBASE_API_KEY=prod_key
VITE_FIREBASE_AUTH_DOMAIN=fac-loc.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://fac-loc-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=fac-loc
VITE_FIREBASE_STORAGE_BUCKET=fac-loc.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=prod_sender_id
VITE_FIREBASE_APP_ID=prod_app_id
VITE_FIREBASE_MEASUREMENT_ID=prod_measurement_id
```

Create or update `.env.staging`:

```env
VITE_FIREBASE_API_KEY=stg_key
VITE_FIREBASE_AUTH_DOMAIN=fac-loc-stg.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://fac-loc-stg-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=fac-loc-stg
VITE_FIREBASE_STORAGE_BUCKET=fac-loc-stg.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=stg_sender_id
VITE_FIREBASE_APP_ID=stg_app_id
VITE_FIREBASE_MEASUREMENT_ID=stg_measurement_id
```

## 2. Firebase Config

Update `src/firebase.js`:

```js
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
```

## 3. Branch-Aware Vercel Build

Create `scripts/vercel-build.js`:

```js
import { spawnSync } from 'node:child_process';

const branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || '';
const mode = branch === 'stg' ? 'staging' : 'production';

console.log(`Building STI Locator for ${mode} mode${branch ? ` from branch ${branch}` : ''}.`);

const result = spawnSync('vite', ['build', '--mode', mode], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "build": "node scripts/vercel-build.js",
    "build:prod": "vite build --mode production",
    "build:stg": "vite build --mode staging"
  }
}
```

## 4. Vercel SPA Rewrite

Create `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## 5. Git Branches

Production branch:

```bash
git switch main
git push origin main
```

Staging branch:

```bash
git switch -c stg
git push origin stg
```

If `stg` already exists:

```bash
git switch stg
git push origin stg
```

## 6. Link Vercel Project

```bash
npx vercel link --yes --project faculty-locator-thesis --token YOUR_TOKEN
```

## 7. Deploy Production

```bash
git switch main
npx vercel --prod --yes --build-env VERCEL_GIT_COMMIT_REF=main --token YOUR_TOKEN
```

Assign production alias:

```bash
npx vercel alias set faculty-locator-thesis.vercel.app stilocator-prod.vercel.app --token YOUR_TOKEN
```

Production URL:

```txt
https://stilocator-prod.vercel.app
```

## 8. Deploy Staging

```bash
git switch stg
npx vercel --yes --build-env VERCEL_GIT_COMMIT_REF=stg --token YOUR_TOKEN
```

Assign staging alias:

```bash
npx vercel alias set STAGING_DEPLOYMENT_URL stilocator-stg.vercel.app --token YOUR_TOKEN
```

Staging URL:

```txt
https://stilocator-stg.vercel.app
```

## 9. Daily Workflow

Deploy production changes:

```bash
git switch main
git add .
git commit -m "Your update"
git push origin main
npx vercel --prod --yes --build-env VERCEL_GIT_COMMIT_REF=main --token YOUR_TOKEN
```

Deploy staging changes:

```bash
git switch stg
git add .
git commit -m "Test update"
git push origin stg
npx vercel --yes --build-env VERCEL_GIT_COMMIT_REF=stg --token YOUR_TOKEN
```

Merge staging into production:

```bash
git switch main
git merge stg
git push origin main
npx vercel --prod --yes --build-env VERCEL_GIT_COMMIT_REF=main --token YOUR_TOKEN
```

## 10. Token Safety

After using a Vercel token, rotate or revoke it in Vercel.

