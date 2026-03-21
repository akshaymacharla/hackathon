# Voice-First Smart Attendance System (Level 3+ Secure Upgrade)

A professional, hackathon-ready smart attendance system with Level 3 security features: QR session control, focus locking, and voice biometrics.

## 🚀 Deployment Instructions

This project is configured for a decoupled deployment:
- **Backend (API):** Render
- **Frontend (Web App):** Vercel

### 1. Backend Deployment (Render)
1. Sign in to [Render](https://render.com/).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Set the following:
   - **Name:** `voice-attendance-backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `cd backend && gunicorn app:app` (Procfile handles this too)
5. Add **Environment Variables**:
   - `MURF_API_KEY`: Your Murf AI API Key.
   - `PYTHON_VERSION`: `3.10` or higher.
6. Click **Create Web Service**.
7. Once deployed, copy your service URL (e.g., `https://voice-attendance-backend.onrender.com`).

### 2. Frontend Deployment (Vercel)
1. Sign in to [Vercel](https://vercel.com/).
2. Click **Add New** > **Project**.
3. Import your GitHub repository.
4. Set the **Root Directory** to `frontend`.
5. Under **Build & Development Settings**, keep defaults (Vercel will treat it as a static site).
6. Click **Deploy**.
7. Once deployed, get your Vercel URL.

### 3. Final Step: Linking Frontend to Backend
1. Open `frontend/static/script.js`.
2. Find the `BACKEND_URL` variable at the top.
3. Replace the placeholder with your Render Backend URL:
   ```javascript
   const BACKEND_URL = "https://your-backend-url.onrender.com";
   ```
4. Push your changes to GitHub. Vercel will automatically redeploy.

## 🛡️ Key Security Features
- **Teacher-Controlled QR Sessions**: Real-time session validation.
- **Browser Focus Lock**: Prevents tab switching/minimizing during attendance.
- **Level 3 Voice Biometrics**: Powered by Resemblyzer (Cosine Similarity).
- **Intelligent Voice Feedback**: Integrated with Murf AI.

## 🛠 Local Setup
1. `pip install -r backend/requirements.txt`
2. Create a `.env` in the root with `MURF_API_KEY=your_key`.
3. Run: `python backend/app.py`
4. Open `frontend/index.html` in your browser.

---
**Built for the Future of Secure Education.**
*Powered by Resemblyzer & Murf AI*
