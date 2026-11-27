# AutoLedger — Backend

REST API for AutoLedger, an expense tracker with debt management and AI-powered spending features.

**Frontend repo:** https://github.com/SAMEERSHARMA123/autoledger_client.git
**Live app:** https://autoledger-client.onrender.com

---

## Tech Stack

| Area | Technology |
|------|------------|
| Runtime / Framework | Node.js, Express |
| Authentication | Email/password and Google OAuth |
| Security | Rate limiting |
| AI | Google Gemini API |
| File storage | Cloudinary (proof images) |

---

## Features

- **Authentication**
  - Email and password sign-up and login
  - Google OAuth sign-in, which saves the user's name, email and profile image
  - Password change
- **Expenses and income**
  - Create, read, update and delete entries
  - Category, payment method (UPI, Cash, Card) and expense/income type
  - Filtering by search text, category, payment method, amount range and date range
  - Server-side pagination
  - Proof images uploaded to Cloudinary
- **Summaries**
  - Dashboard totals: net balance, monthly inflow and outflow, active debts
  - Daily safe limit, 7-day spending and category split
- **Debts**
  - Lent and borrowed records per person
  - Partial payments, full settlement and settled history
- **Settings**
  - Profile name and photo
  - Monthly budget limit and alert thresholds
  - Theme preference
- **AI with Gemini**
  - **Voice quick add:** turns spoken text with any number of expenses into structured entries (title, amount, category). Limited to 2 uses per week per user.
  - **Weekly insights:** generates short spending tips from the user's activity once a week
- **Rate limiting** to protect the API from abuse and to control AI usage

---

## Getting Started

### Prerequisites
- Node.js 18 or later
- A database connection string
- Google OAuth credentials (Google Cloud Console)
- A Gemini API key (Google AI Studio)
- A Cloudinary account

### Installation

```bash
git clone <backend-repo-url>
cd autoledger-server
npm install
```

### Environment variables

Create a `.env` file in the project root. Rename the variables to match your code if they differ.

```env
PORT=5000
DATABASE_URL=your_database_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GEMINI_API_KEY=your_gemini_api_key

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Never commit your `.env` file.

### Run

```bash
# development
npm run dev

# production
npm start
```

The API runs at `http://localhost:5000`.

---

## Project Structure

> Update this to match your folders.

```
autoledger-server/
├── config/         # Database, Cloudinary and OAuth setup
├── controllers/    # Request handlers
├── middleware/     # Auth, rate limiting, error handling
├── models/         # Data models
├── routes/         # API routes (auth, expenses, debts, insights, settings)
├── services/       # Gemini AI logic
└── server.js       # App entry point
```

---

## API Modules

| Module | Purpose |
|--------|---------|
| Auth | Register, login, Google OAuth, password change |
| Expenses | Manage income and expense entries, filters, pagination, proof upload |
| Debts | Lent and borrowed records, partial and full settlement |
| Insights | Summary data and weekly AI tips |
| AI | Voice quick add with weekly usage limit |
| Settings | Profile, budget limit, theme |

---

## Security Notes

- Rate limiting on the API and stricter limits on AI endpoints
- Secrets and API keys stay on the server in environment variables
- AI output is validated before it is saved
- Passwords are stored hashed

---

## Deployment

Deployed on Render. Add every variable from the `.env` section above in the service's environment settings, and set `CLIENT_URL` to the deployed frontend URL so CORS and the Google OAuth redirect work.

---

## Author

**Sameer Sharma** — Jaipur, India

© 2026 Sameer Sharma. See LICENSE for terms.
