# Hotel Booker

A hotel room booking dashboard built with Express, SQLite, and a static browser interface.

## Run locally

Requirements: Node.js and npm.

```powershell
npm install
npm start
```

Open http://localhost:3000. The SQLite database is created at `database/hotel.sqlite` on first run and sample rooms are seeded automatically. Local database files are excluded from Git so guest booking data is not published.

## API

- `GET /api/health` — health check
- `/api/rooms` — room inventory
- `/api/bookings` — reservations
- `/api/stats` — booking statistics
