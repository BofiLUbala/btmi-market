# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Dependency notes

- `react-dom` is pinned to the same version as `react` on purpose. `expo-router`
  pulls it in for web support as an optional peer; left unconstrained npm
  resolves it to a newer patch that demands a newer `react` than the SDK pins,
  and `npm install` then fails with ERESOLVE. Keep the two in lockstep instead
  of reaching for `--legacy-peer-deps`.
