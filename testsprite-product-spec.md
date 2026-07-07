# Goalix Product Specification

Goalix is a football academy management web app with separate portals for admins,
coaches, and players. The application should allow authenticated users to view and
manage academy data such as players, coaches, training sessions, matches,
attendance, assignments, performance, notifications, calendar events, and chat.

## Primary User Roles

- Admin: manages players, coaches, matches, notifications, reports, and academy data.
- Coach: manages assignments, training, measurements, rankings, match configuration,
  match day workflows, and team communication.
- Player: views personal dashboard, assignments, attendance, calendar, matches,
  training, performance progress, profile, notifications, and chat.

## Backend API Routing For TestSprite

This document is for backend/API TestSprite runs.

- Backend health URL: http://localhost:3000/health
- Backend API base path: http://localhost:3000/api/v1
- Do not use the frontend server on port 3001 for backend API tests.
- Do not use UI page paths as API paths.
- Do not use /api/auth/admin-login because it does not exist.
- Do not use /api/auth/login because it does not exist.
- Do not use /api/admin/login because it does not exist.
- Do not use /api/v1/auth/admin-login because it does not exist.
- Correct staff login endpoint: POST /api/v1/auth/admin/login.
- Correct player login endpoint: POST /api/v1/auth/login.
- Correct admin player list endpoint: GET /api/v1/players.
- Correct admin coach list endpoint: GET /api/v1/coaches.

## Seeded Test Credentials

Seeded test users use the password provided through the seed environment:

- Password: `<DEMO_USER_PASSWORD>`

Admin account:

- API login endpoint: POST /api/v1/auth/admin-login
- Identifier/email: admin@goalix.com
- Dashboard API: GET /api/v1/admin/dashboard

Coach account:

- API login endpoint: POST /api/v1/auth/admin-login
- Identifier/email: coach1@goalix.com
- Alternative coach emails: coach2@goalix.com, coach3@goalix.com, coach4@goalix.com
- Coach dashboard API: GET /api/v1/coaches/me/dashboard

Player account:

- API login endpoint: POST /api/v1/auth/login
- Identifier/email: player1@goalix.com
- Alternative player emails: player2@goalix.com, player3@goalix.com, player4@goalix.com
- Player profile API: GET /api/v1/player/profile
- Player progress API: GET /api/v1/player/progress

Login request bodies for API tests:

- Admin: `{ "email": "admin@goalix.com", "password": "<DEMO_USER_PASSWORD>" }`
- Coach: `{ "email": "coach1@goalix.com", "password": "<DEMO_USER_PASSWORD>" }`
- Player: `{ "email": "player1@goalix.com", "password": "<DEMO_USER_PASSWORD>", "role": "player" }`

Authentication is cookie-based. API tests should use `requests.Session` or an
equivalent cookie jar. API tests may also use the returned access token as
`Authorization: Bearer <token>` if present.

## Full App Test Scope

Test the main authenticated flows for all three roles.

Admin pages to cover:

- /admin/dashboard
- /admin
- /admin/players
- /admin/coaches
- /admin/matches
- /admin/notifications
- /admin/reports/player-progress
- /admin/calendar
- /admin/academy/branches
- /admin/academy/groups
- /admin/academy/birth-years

Coach pages to cover:

- /coach/home
- /coach/assignments
- /coach/training
- /coach/matches
- /coach/matches/configuration
- /coach/measurements
- /coach/rankings
- /coach/calendar
- /coach/my-groups

Player pages to cover:

- /player/home
- /player/assignments
- /player/attendance
- /player/calendar
- /player/matches
- /player/training
- /player/performance/progress
- /player/profile

## Player Home Page Scope

The player home page should display a dashboard for the logged-in player.

Expected behavior:

- Show a welcome header using the player's name when profile data is available.
- Show KPI cards for attendance, matches played, weekly minutes, goals, and assists.
- Show a player snapshot with position, group, branch, and profile status.
- Show the next upcoming match, including opponent, date, time, location, status,
  squad role, position, rating, and minutes where available.
- Show upcoming training and calendar events.
- Show the latest coach feedback with overall, technical, and physical ratings.
- Show the most recent completed match when available.
- Show loading states while data is being fetched.
- Show useful empty states when no data is available.
- Show a warning if some backend data cannot be loaded while still rendering any
  available sections.

## Authentication Expectations

The app uses its own user login flow. Automated tests should use the configured
local app URL and authenticate through the UI if credentials are available.
If no credentials are available, tests should still check public routing, page
loading, redirects, and visible unauthenticated states.

For this local seeded test run, credentials are available and should be used.
Staff users, including both admins and coaches, authenticate only through
POST /api/v1/auth/admin/login in backend tests. Players authenticate only through
POST /api/v1/auth/login with `role: "player"` in backend tests.

## Quality Goals

- Pages should render without runtime errors.
- Navigation between portal sections should work.
- Responsive layouts should remain readable on desktop and mobile sizes.
- Loading, error, and empty states should be visible and understandable.
- API failures should not crash the whole page.
- Buttons and links should be accessible and clickable.

## Local Backend Test Target

- Backend URL: http://localhost:3000
- API base: http://localhost:3000/api/v1
- Health: http://localhost:3000/health
