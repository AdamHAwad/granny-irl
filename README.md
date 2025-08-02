# Granny IRL

A companion app for real-life tag games inspired by Friday the 13th. Players use this app to track game state during outdoor tag games.

## Features

- Google Sign-In authentication
- Create and join game rooms with 6-digit codes
- Customizable settings (killer count, round length)
- Real-time game tracking
- Self-reporting elimination system
- Mobile-optimized for outdoor use

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Firebase:
   - Create a Firebase project
   - Enable Authentication (Google provider)
   - Enable Realtime Database
   - Copy `.env.local.example` to `.env.local` and add your Firebase config

3. Run the development server:
   ```bash
   npm run dev
   ```

## Tech Stack

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Firebase (Auth + Realtime Database)
- React Hooks for state management