# Voice-First Smart Attendance System (Level 3+ Secure Upgrade)

A professional, hackathon-ready smart attendance system upgraded with **Level 3+ Security features**. This system ensures physical presence and prevents cheating through a combination of QR session control, browser-based focus locking, and robust voice biometrics.

## 🛡️ Key Security Features

### 1. Teacher-Controlled QR Sessions
- **Dynamic QR Code**: Teachers initiate a session, generating a unique ID and a time-limited QR code (60s expiry).
- **Physical Presence**: Students must be physically in the room to scan the QR code from the smart board.
- **Single-Use**: Each student can only mark attendance once per session ID.

### 2. Browser Focus Lock (Anti-Cheating)
- **Immediate Detection**: Once a student enters an attendance session, the "Focus Mode" triggers.
- **Disqualification**: If the student switches tabs, minimizes the browser, or opens another app, they are **immediately disqualified** for that session.
- **Persistent Overlay**: A "Session Terminated" overlay prevents any further interaction after a security breach.

### 3. Level 3 Voice Biometrics
- **3-Sample Registration**: Students record 3 voice samples during registration. The system averages these embeddings for a highly accurate biometric signature.
- **Dual-Layer Verification**:
    1. **Text Verification**: Ensures the student says the unique daily "Challenge Sentence" to prevent replay attacks.
    2. **Voice Verification**: Uses **Resemblyzer** for cosine similarity check (Threshold: 0.65).
- **Intelligent Responses**: Real-time voice confirmation via **Murf AI**.

## 🚀 Setup Instructions

1.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

### ⚠️ Windows Fix (Resemblyzer)
`resemblyzer` requires C++ build tools for `webrtcvad`:
1.  Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Select "Desktop development with C++").
2.  Install [CMake](https://cmake.org/download/) and **Add to PATH**.
3.  Restart terminal and run: `pip install resemblyzer numpy soundfile`

2.  **Add Your Murf API Key:**
    Create a `.env` file in the root directory:
    ```env
    MURF_API_KEY=your_apikey_here
    ```

3.  **Run the Backend:**
    ```bash
    python backend/app.py
    ```

## 🛠 Project Structure
- `backend/app.py`: Flask server with session management and Resemblyzer integration.
- `frontend/templates/index.html`: Responsive UI with Student/Teacher view switching.
- `frontend/static/script.js`: Core logic for QR scanning, audio capture, and Focus Lock.
- `embeddings/`: Directory where registered voice signatures are stored.
- `students.json`: Student database for quick lookup.

---

**Built for the Future of Secure Education.**
*Powered by Resemblyzer & Murf AI*
