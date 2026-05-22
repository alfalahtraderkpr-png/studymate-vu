# StudyMate VU 🎓

AI-Powered Study Assistant for Virtual University of Pakistan students.

## Features

- **VULMS Login** - Enter your Student ID and Password, AI logs in automatically
- **Deep Explanations** - AI explains handouts with real-life examples in Roman Urdu + English
- **Chat Q&A** - Ask any question about your subjects
- **Quiz Mode** - Practice MCQs generated from your handouts for exam preparation
- **Read-Only Access** - No activities on LMS, VU cannot detect it

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Puppeteer (VULMS automation)
- AI-powered explanations via z-ai-web-dev-sdk
- Prisma + SQLite

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
git clone https://github.com/alfalahtraderkpr-png/studymate-vu.git
cd studymate-vu
npm install
```

### Setup

```bash
# Copy environment file
cp .env.example .env

# Setup database
npx prisma db push

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Vercel Deployment

1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Add environment variables:
   - `DATABASE_URL` - PostgreSQL connection string (use Vercel Postgres or Turso)
4. Deploy!

**Note:** Puppeteer requires special configuration on Vercel. You may need to use `@sparticuz/chromium` for serverless Puppeteer support.

## Usage

1. Open the app
2. Enter your VULMS Student ID and Password
3. Click "Login to VULMS"
4. Wait 15-30 seconds for subjects to load
5. Click "Study" on any subject
6. Open a handout → AI explains it deeply
7. Use Chat tab for Q&A
8. Use Quiz tab for exam practice

## How It Works

1. User provides VULMS credentials
2. Server uses Puppeteer (headless browser) to log into VULMS
3. Scrapes subject list and handout links (READ-ONLY)
4. AI processes handout content and provides explanations
5. Chat and Quiz features use AI for interactive learning

## Security

- Credentials are only used for the login session
- No data is stored permanently
- Read-only access - no modifications to your VULMS account
- Sessions expire automatically

## License

MIT
