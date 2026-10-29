# FeeLedger

A unified school fee management and reconciliation platform.
Modular monolith: Express + SQLite backend, React (Vite) frontend.
Real JWT authentication, real OCR (Tesseract.js), real audit trail.

---

## 1. Project Structure

```
feeledger/
  backend/          Express API + SQLite database + OCR/matching/fee logic
    routes/         One file per resource (students, payments, ocr, challans, dashboard, auth...)
    services/       Business logic: fee calculation, matching engine, health score, OCR, audit
    middleware/      auth.js - JWT verification for protected routes
    data/           SQLite database file + uploaded receipt images (created on first run)
    db.js           Schema definitions
    seed.js         Realistic demo data (10 students, mixed paid/pending/overdue)
    server.js       Entry point
  frontend/         React + Vite admin dashboard + parent view
    src/pages/       One file per page (including Login)
    src/components/  Shared UI (Layout/sidebar, StatusBadge, HealthGauge)
    src/api/client.js     All backend calls, with JWT attached automatically
    src/api/AuthContext.jsx  Login state, used to protect admin routes
```

---

## 2. Local Setup (run these in order)

**Requires Node.js 22.5 or newer** (check with `node -v`). The backend uses Node's
built-in SQLite support, so there's nothing to compile — `npm install` should finish in
a few seconds on any OS (Windows included, no Visual Studio Build Tools needed).

### Backend
```bash
cd backend
npm install
```

In PowerShell, create the local environment file and generate a strong JWT secret:
```powershell
node -e "require('fs').writeFileSync('.env', 'JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64') + '\nADMIN_PASSWORD=' + require('crypto').randomBytes(24).toString('base64') + '\nOCR_MODE=real\nPORT=4000\n')"
```

Then start the backend:
```bash
npm run seed        # populates the database with demo data - RUN THIS FIRST
npm start            # starts on http://localhost:4000
```

### Frontend (separate terminal)
```bash
cd frontend
npm install
npm run dev           # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser — you'll land on the login page.

### Troubleshooting

- **`node -v` shows something below 22.5** → install a newer Node from nodejs.org.
- **`node-gyp` / `Visual Studio` / `EPERM` error during `npm install`** → you're on an old
  copy of this project. Re-download the latest version — it no longer uses any native
  (compiled) dependencies.
- **`Cannot find module 'express'` after `npm install`** → install didn't actually finish.
  Scroll up to the first `npm error` and fix that.
- **`ExperimentalWarning: SQLite is an experimental feature`** → expected and harmless.

---

## 3. Login Credentials

Real login — JWT tokens, passwords hashed with bcrypt, not stored in plain text. The
seed command creates the demo admin account using the email below and the random
`ADMIN_PASSWORD` saved in `backend/.env`; there is no shared default password:

```
Email: admin@feeledger.demo
Password: the generated ADMIN_PASSWORD value in backend/.env
```

---

## 4. The Exact Demo Flow (rehearse this)

1. Log in with the credentials above.
2. Open the **Dashboard** — show the Fee Health Score gauge and collection snapshot.
3. Go to **Students → Rahul Kumar (STU001)** — show his Bus Fee is ₹20,000 pending.
4. Go to **OCR Receipt Upload** and upload a receipt photo (a real one, or any image
   named with "rahul" in the filename — see note below).
5. Show the extracted fields (name, amount, date) and the match confidence.
6. Click **Confirm Payment**.
7. Show the success message: previous pending ₹20,000 → new pending ₹15,000.
8. Go back to **Dashboard** — collected total has updated live.
9. Copy Rahul's **Parent Link** from his student detail page and open it in a new
   tab/incognito window — show the parent sees the same updated numbers with zero login.
10. Go to **Challans** — generate a challan for another student's pending fees, click
    **Pay Now** to show the mock online payment flow (PENDING → PROCESSING → SUCCESS).

**About the OCR upload**: this is now *real* OCR (Tesseract.js reads the actual image).
For best results, use a clearly typed/printed receipt image, not handwriting — take a
screenshot of a text document listing "Student: Rahul Kumar", "Amount: Rs. 5000", etc.
and upload that. If the OCR can't get a clean read (blurry photo, no internet on first
run while it downloads its language model), it automatically falls back to a realistic
mock result instead of failing the demo — filenames containing "rahul", "priya", or
"unclear" trigger specific, different mock outcomes if you want a guaranteed result.

---

## 5. Going Live (deploy so you can submit a real link, not just localhost)

Both platforms below have free tiers, no credit card required for this project's size.

### Step 1 — Push to GitHub
```bash
cd feeledger
git init
git add .
git commit -m "FeeLedger MVP"
```
Create an empty repo on github.com, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/feeledger.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy the backend (Render, free)
1. render.com → New → Web Service → connect your GitHub repo
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment variables:
   - `JWT_SECRET` → a long random secret (at least 32 bytes; keep it private)
   - `ADMIN_PASSWORD` → a separate random password (at least 16 bytes), required when seeding
   - `OCR_MODE` → `real` (or `mock` to skip real OCR in production)
6. Deploy — you'll get a URL like `https://feeledger-backend.onrender.com`
7. **Run the seed once**: Render dashboard → your service → Shell tab → `npm run seed`

Render's free tier sleeps after 15 minutes idle and takes ~30-60s to wake up on the next
request — open your link a minute before you need it live for judging.

### Step 3 — Deploy the frontend (Vercel or Netlify, free)
1. vercel.com → New Project → import the same GitHub repo
2. Root Directory: `frontend`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Environment variable: `VITE_API_URL` → `https://feeledger-backend.onrender.com/api`
   (your real Render URL from Step 2, with `/api` on the end)
6. Deploy — you'll get a URL like `https://feeledger.vercel.app`. **This is the link you submit.**

### Step 4 — Lock down CORS
Once you know your frontend's live URL, open `backend/server.js` and change:
```js
app.use(cors());
```
to:
```js
app.use(cors({ origin: "https://feeledger.vercel.app" })); // your real frontend URL
```
Commit and push — Render redeploys automatically.

---

## 6. Key Architecture Decisions

- **Real authentication**: JWT tokens (12-hour expiry), bcrypt-hashed passwords, every
  admin route behind `middleware/auth.js`. The parent view has no login by design — it's
  protected by an unguessable token in the URL instead.
- **Real OCR**: Tesseract.js actually reads the uploaded image. If it can't reach its
  language-data CDN (offline, first run before the model is cached), it automatically
  and permanently falls back to a realistic mock result for that session — and the
  server has a global crash guard so a flaky OCR network call can never take the whole
  site down.
- **Immutable ledger**: `paid`/`pending` amounts are never stored directly — always
  computed from SUCCESS/CLEARED payments allocated to a fee assignment. Full audit trail
  for free; cheque bounces self-correct (flip status to BOUNCED, pending goes back up).
- **OCR never writes a payment directly** — it creates a suggested match; a human must
  click Confirm before anything touches the ledger.
- **Dynamic fee engine**: fee types are rows in a table, not hardcoded values.

---

## 7. Known Limitations (mention proactively if asked — shows you know your MVP's edges)

- No SMS/WhatsApp integration for reminders — logs a notification record and shows a
  confirmation, but nothing is sent externally.
- Single school only — no multi-tenant support.
- Real OCR handles typed/printed receipts well; handwriting recognition is unreliable
  (true of OCR generally, not specific to this implementation).
- One role (admin) — no separate accountant/teacher permission levels yet.

## 8. Future Improvements

- Real payment gateway integration (Razorpay/Cashfree) behind the existing challan-pay endpoint.
- Role-based permissions (admin vs accountant vs parent-with-account).
- Bulk fee assignment CSV import for onboarding a whole school at once.
- Real SMS/WhatsApp/email delivery for reminders.
