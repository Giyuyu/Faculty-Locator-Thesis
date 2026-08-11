# Security Hardening Setup

The code is prepared for secure Firebase access, but the rules and data migration must be released together. Do not deploy `database.rules.json` until the steps below are complete.

## 1. Firebase Authentication

Keep the existing administrator in Firebase Authentication and ensure its matching Realtime Database record is:

```text
users/<firebase-auth-uid>/role_id = admin
users/<firebase-auth-uid>/role_ids = [admin]
users/<firebase-auth-uid>/status = active
```

The web and mobile apps now accept Firebase Authentication passwords only. Database password fields are never used for login.

Enable **Anonymous** authentication in Firebase Console for the kiosk. The anonymous account can only read the sanitized public tracker records allowed by the security rules.

## 2. Desktop Accounts

Create separate Firebase Authentication accounts for:

- Desktop faculty login device: `role_id = device`
- Desktop administration tool: `role_id = admin`

Add each account under `users/<firebase-auth-uid>` with `status = active`. Do not reuse a person's normal administrator password for a deployed desktop device.

Copy the ignored credential template:

```powershell
Copy-Item .env.desktop.example .env.desktop.local
```

Fill in strong, unique production and staging credentials. `.env.desktop.local` is ignored by Git and must be configured independently on each desktop.

## 3. Remove Legacy Password Data

Before deploying the secure rules, run the migration once per environment. It removes every legacy `users/*/password` field and creates the sanitized `public_faculties` directory used by the kiosk.

```powershell
$env:FIREBASE_MIGRATION_EMAIL = "your-existing-admin@email"
$env:FIREBASE_MIGRATION_PASSWORD = "your-admin-password"
npm run security:migrate-data
```

The command above targets staging. For production:

```powershell
npm run security:migrate-data -- --production
```

Clear the two temporary PowerShell variables after migration:

```powershell
Remove-Item Env:FIREBASE_MIGRATION_EMAIL
Remove-Item Env:FIREBASE_MIGRATION_PASSWORD
```

## 4. Deploy Rules Later

After web, mobile, kiosk, and both desktop clients authenticate successfully in staging:

```powershell
npx firebase deploy --only database --project fac-loc-stg
```

Repeat the migration and verification before deploying production rules. No security rules or application changes were deployed automatically by this work.

## 5. Password Resets

Password resets use the Vercel Function in `api/reset-password.js`. The endpoint
verifies the caller's Firebase ID token and active Admin role before updating
the selected Firebase Authentication account. It returns a generated temporary
password once to the administrator's browser for copying.

The temporary password is never written to Realtime Database or application
logs. Realtime Database stores only reset audit metadata and the
`password_change_required` flag. Firebase Authentication hashes the password.

```powershell
npm run local:db
```

No Firebase Cloud Function or Blaze plan is required. Vercel Functions are
available within the free Hobby-plan limits. Configure these server-only Vercel
environment variables separately for Production and Preview/Staging:

```text
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
FIREBASE_ADMIN_DATABASE_URL
```

Use the `fac-loc` service account values for Production and the `fac-loc-stg`
values for Preview/Staging. Never add these values to a `VITE_` variable or a
tracked `.env` file. Deploy database rules normally:

```powershell
npx firebase deploy --only database --project fac-loc-stg
```

Use the production project only after the staging reset-email flow, web login,
mobile login, kiosk, and desktop clients have been verified.

## 6. Recommended Console Controls

- Require multi-factor authentication for administrator accounts if Identity Platform is enabled.
- Enable Firebase App Check for web applications.
- Restrict Firebase API keys by API and authorized website where supported.
- Review Firebase Authentication users and Realtime Database audit activity regularly.
- Use unique desktop accounts per physical installation so access can be revoked independently.
