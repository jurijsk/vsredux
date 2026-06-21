# Releasing

How to cut a release of `@jurijsk/vsredux` and how npm auth in CI is set up.

## Cut a release

1. Commit your changes and make sure the gates pass:

   ```bash
   npm run check   # format, lint, type-check
   npm test
   ```

2. Bump, tag, and push — this triggers the publish workflow:

   ```bash
   npm run release            # bumpp prompts for the new version
   # or non-interactively:
   npm run release -- minor   # patch | minor | major
   ```

   `bumpp` updates `package.json`, commits, creates a `vX.Y.Z` tag, and pushes it.
   The pushed tag triggers [`.github/workflows/publish.yml`](.github/workflows/publish.yml),
   which installs, runs `check` + `test`, builds `dist/`, and publishes to npm.

3. Confirm it landed:

   ```bash
   npm view @jurijsk/vsredux version    # should be the version you just tagged
   ```

Pre-1.0, use **minor** for new features and **patch** for fixes.

## CI npm authentication

The publish step has to authenticate to npm. Pick **one** of the options below. The
workflow is currently wired for Option 1.

### Option 1 — Trusted Publishing via OIDC (current)

No secret or `.npmrc` needed, and npm attaches build provenance automatically.
Requires npm >= 11.5.1 (the workflow upgrades npm) and a one-time publisher config
on npmjs.com, done after the package's first manual publish:

> Package settings → **Trusted Publisher** → GitHub Actions
>
> - Organization or user: `jurijsk`
> - Repository: `vsredux`
> - Workflow filename: `publish.yml` (case-sensitive)

Until that publisher is configured, the publish step fails with `ENEEDAUTH`.

### Option 2 — Automation token

Use this if Trusted Publishing isn't an option. One-time setup:

1. **Create a token** — npmjs.com → Profile → Access Tokens → Generate New Token →
   a **Granular Access Token** with "Read and write" scoped to `@jurijsk/vsredux`
   (a classic **Automation** token works too).
2. **Store it in GitHub** — repo → Settings → Secrets and variables → Actions →
   New repository secret named `NPM_TOKEN`; paste the token value.
3. **Switch the workflow** — in `publish.yml`, delete the `permissions: id-token: write`
   block, then replace the final `npm publish` step with:

   ```yaml
   - run: echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
     env:
       NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
   - run: npm publish --access public
   ```

Tokens don't add provenance and have to be rotated when they expire, but they need
no web-UI publisher config.

## Manual publish (fallback)

From a machine where you're logged in (`npm whoami`):

```bash
npm publish --access public
```

`prepublishOnly` rebuilds `dist/` first. This works without CI at all — use it any
time CI auth isn't ready yet.

## Re-running a failed publish

If a tag was pushed before CI auth was ready, fix the auth (Option 1 or 2) and re-run
that workflow run — the version isn't published yet, so it will go through:

```bash
gh run list --limit 5     # find the failed run's id
gh run rerun <run-id>
gh run watch
```
