# JEE Edge

A responsive JEE Advanced study dashboard with secure sign-up/login, persistent study timers, rank trajectory, daily tasks, and read-only student lookup.

## Run locally

1. Copy `.env.example` to `.env`.
2. Replace `<db_password>` in `MONGODB_URI` with your MongoDB Atlas password. Keep `.env` private.
3. Set a long random `JWT_SECRET`.
4. Run `npm.cmd install`, then `npm.cmd start`.
5. Open `http://localhost:3000`.

The app uses MongoDB when `MONGODB_URI` is present. Without it, the frontend still serves, but account and progress APIs cannot persist data.

## Rank model

Every user starts at AIR 15,00,000. Rank combines chapter completion, lecture minutes, question-practice minutes, revision minutes, and a consistency factor. Revision has the strongest effect, followed by question practice and lecture. A power curve creates diminishing returns as rank improves, while rank history is stored for the trajectory chart.
