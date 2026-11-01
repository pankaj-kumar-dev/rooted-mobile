# ROOTED — React Native MVP

ROOTED is a local-first habit tracker built with Expo and React Native. Its core principle is progress without punishment: good day `+1`, slip-up `−1`, and skipped check-in `0`, while history remains visible.

## Included

- Four-tab mobile experience: Today, Journey, Habits, Settings
- Up to five active habits
- Custom habit names, descriptions, and personal good-day/slip definitions
- One check-in per habit per local calendar day
- Independent habit ratings and combined growth total
- Per-habit history and a 30-check-in staircase-style chart
- Archive habits without deleting their history
- Local persistence with AsyncStorage
- Delete-all-data control
- No account, analytics, backend, or network requests configured

## Run locally

Requirements: Node.js LTS and Expo Go (or an Android/iOS simulator).

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` for Android / `i` for iOS when a simulator is installed.

## Product rules

- New habits start at rating `1`.
- Good day adds `+1`.
- Slip-up subtracts `1`, with a rating floor of `1`.
- Skip records a neutral `0` outcome and leaves the rating unchanged.
- Each active habit can have at most one check-in per local calendar date.
- Habits are independent; checking in on one never changes another.
- Active habits are capped at five. Archived habits retain their history.

## Important implementation notes before public release

This is a runnable MVP scaffold, not a certified production release. Before store submission:

1. Install dependencies and run `npx expo-doctor`, `npx tsc --noEmit`, and device-level tests.
2. Add automated unit tests for rating transitions, timezone/date boundaries, migrations, archive/restore, and persistence failures.
3. Decide whether users need editing, restoring archived habits, export/import, and device backup.
4. Add an explicit privacy policy and verify platform store disclosures. AsyncStorage is convenient local storage, not encrypted storage.
5. Consider a transactional persistence layer and schema migrations before changing the data model.
6. Test accessibility, larger font sizes, small devices, and screen readers.
7. Configure app icons, splash assets, store metadata, signing, and release builds.

## Data location

All user data is persisted in the app's local AsyncStorage key `@rooted/state-v1`. Clearing app data or uninstalling may delete this data. No cloud sync or recovery is included.
