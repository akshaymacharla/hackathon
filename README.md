# Voice-First Smart Attendance System (Level 3 Secure Upgrade)

A complete, hackathon-ready prototype of a voice-first smart attendance system upgraded with **Level 3 Security features**. It utilizes dual-verification: combining text (what is said) with voice biometrics (who is saying it) to prevent spoofing.

## Features
- **Registration Phase**: Students register their name and record a voice sample. The system generates a numerical Voice Embedding (biometric signature).
- **Dual-Layer Attendance (Level 3)**:
  1. **Text Verification**: Uses `SpeechRecognition` to ensure the student actually said their name.
  2. **Voice Verification**: Uses `resemblyzer` to generate an embedding of the live audio and calculates **Cosine Similarity** against their registered signature. Passes only if score > 0.75.
- **Intelligent Responses**: Generates dynamic voice confirmations using Murf AI API.

## Prerequisites

- Python 3.8+
- Active Internet Connection (for STT and Murf AI services)
- [Murf AI API Key](https://murf.ai)

## Setup Instructions

1. **Install dependencies:**
   Open a terminal in this directory and run:
   ```bash
   pip install -r requirements.txt
   ```

### ⚠️ Fixing Resemblyzer on Windows (CRITICAL FOR LEVEL 3)
The `resemblyzer` packge relies on `webrtcvad`, which contains C++ code that must be compiled natively on Windows. 

**Follow these exact steps to fix the common C++ installation error:**

1. **Install Microsoft Visual Studio Build Tools:**
   - Go to [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
   - Download and run the installer (`vs_buildtools.exe`).
   - In the installer, check the box for **"Desktop development with C++"**.
   - Make sure **"MSVC v143 - VS 2022 C++ x64/x86 build tools"** and **"Windows 10/11 SDK"** are selected on the right side.
   - Click **Install** (This is a large download and might take a while).

2. **Install CMake:**
   - Go to [CMake Downloads](https://cmake.org/download/).
   - Download the Windows x64 Installer (e.g., `cmake-3.XX.X-windows-x64.msi`).
   - Run the installer. **CRITICAL:** When asked, select **"Add CMake to the system PATH for all users"**.

3. **Restart Your Terminal/Computer:**
   - Close your current terminal to refresh the environment variables, or restart your PC safely.

4. **Verify Installation:**
   ```bash
   cl
   cmake --version
   ```
   *(Both commands should output version info and not "command not found").*

5. **Retry Installation:**
   ```bash
   pip install resemblyzer numpy soundfile
   ```

2. **Add Your Murf API Key:**
   Create a `.env` file in the root directory (where `app.py` is located) and add your Murf API credentials:
   ```env
   MURF_API_KEY=your_murf_api_key_here
   ```
   *(Note: The system will still work without the API key, but it will skip generating voice feedback and will show a fallback UI message instead.)*

3. **Configure the Database (Optional):**
   Modify `students.json` to include any custom names you wish to test with.

4. **Run the Backend:**
   ```bash
   python app.py
   ```

5. **Test the Application:**
   Open your browser and navigate to `http://localhost:5000`. 
   - **Step 1:** Go to the "Register Voice" tab, enter your name, and record a short sample.
   - **Step 2:** Go to the "Mark Attendance" tab, say "I am [Your Name]". See the security score calculate and successfully log you in!
   - **Step 3:** Have a friend try to spoof your name to see it rejected by the biometric similiarity score.

## Project Structure
- `app.py`: Flask routing and backend logic connecting to STT/TTS APIs.
- `students.json`: Mock database.
- `templates/index.html`: Web interface.
- `static/style.css`: Modern visual styling for the frontend.
- `static/script.js`: Client-side logic for capturing hardware audio into browser-native valid WAV blobs for backend analysis.
