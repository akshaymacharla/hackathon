import os
import json
import requests
import numpy as np
import soundfile as sf
import speech_recognition as sr
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv

# STRICT: Must use real resemblyzer. No fallback.
from resemblyzer import VoiceEncoder, preprocess_wav

load_dotenv()

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')

MURF_API_KEY = os.environ.get("MURF_API_KEY", "")
STUDENTS_FILE = "students.json"
EMBEDDINGS_DIR = "embeddings"
SIMILARITY_THRESHOLD = 0.65 

# Session Management (In-memory for Hackathon Simplicity)
active_sessions = {} # session_id -> { "created_at": timestamp, "used_by": set(names), "disqualified": set(names) }
SESSION_EXPIRY = 60 # Seconds

CHALLENGE_SENTENCES = [
    "Today is a great day",
    "AI is the future",
    "Voice authentication is secure",
    "Learning never stops",
    "The weather is lovely",
    "Technology changes fast"
]

if not os.path.exists(EMBEDDINGS_DIR):
    os.makedirs(EMBEDDINGS_DIR)

# LOAD MODEL ONLY ONCE (Global Instance)
print("-----------------------------------------")
print("SYSTEM: Initializing Voice Attendance System...")
print("SYSTEM: Loading VoiceEncoder model... (this might take a few seconds)")
encoder = VoiceEncoder()
print("SYSTEM: VoiceEncoder loaded successfully. Ready for verification.")
print("-----------------------------------------")

def load_students():
    if os.path.exists(STUDENTS_FILE):
        with open(STUDENTS_FILE, "r") as f:
            students = json.load(f)
            # Ensure all students have a failed_attempts counter
            for s in students:
                if "failed_attempts" not in s:
                    s["failed_attempts"] = 0
            return students
    return []

def save_students(students):
    with open(STUDENTS_FILE, "w") as f:
        json.dump(students, f, indent=2)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/get-challenge", methods=["GET"])
def get_challenge():
    import random
    return jsonify({"challenge": random.choice(CHALLENGE_SENTENCES)})

@app.route("/api/start-session", methods=["POST"])
def start_session():
    import uuid
    import time
    session_id = str(uuid.uuid4())[:8] # Short unique ID
    active_sessions[session_id] = {
        "created_at": time.time(),
        "used_by": set(),
        "disqualified": set()
    }
    print(f"DEBUG: New Session Started: {session_id}")
    return jsonify({"session_id": session_id, "timestamp": time.time()})

@app.route("/api/disqualify", methods=["POST"])
def disqualify_user():
    data = request.json
    session_id = data.get("session_id")
    name = data.get("name", "").strip().lower()
    
    if session_id in active_sessions and name:
        active_sessions[session_id]["disqualified"].add(name)
        print(f"DEBUG: User '{name}' DISQUALIFIED for session {session_id}")
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Invalid session or name"}), 400

@app.route("/register", methods=["POST"])
def register_student():
    name = request.form.get("name", "").strip()
    if not name:
        return jsonify({"error": "Student name is required"}), 400
        
    # Collect all audio samples (expecting multiple files)
    audio_files = request.files.getlist("audio")
    if not audio_files:
        return jsonify({"error": "No voice samples provided"}), 400
        
    print(f"DEBUG: Received {len(audio_files)} samples for {name}")
    
    try:
        embeddings = []
        for i, audio_file in enumerate(audio_files):
            temp_path = f"temp_reg_{name.replace(' ', '_')}_{i}.wav"
            audio_file.save(temp_path)
            
            print(f"DEBUG: Processing sample {i+1} for {name}...")
            wav = preprocess_wav(temp_path)
            emb = encoder.embed_utterance(wav)
            embeddings.append(emb)
            
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
        # Calculate Mean Embedding
        final_embedding = np.mean(embeddings, axis=0)
        print(f"DEBUG: Final averaged embedding created for {name}")
        
        # Save as .npy file
        npy_path = os.path.join(EMBEDDINGS_DIR, f"{name.replace(' ', '_')}.npy")
        np.save(npy_path, final_embedding)
        
        students = load_students()
        student_exists = False
        for student in students:
            if student["name"].lower() == name.lower():
                student["npy_file"] = npy_path
                student["failed_attempts"] = 0
                student_exists = True
                break
                
        if not student_exists:
            new_id = str(len(students) + 1)
            students.append({
                "id": new_id,
                "name": name,
                "npy_file": npy_path,
                "failed_attempts": 0
            })
            
        save_students(students)
        return jsonify({
            "success": True, 
            "message": f"Student '{name}' registered successfully with {len(audio_files)} voice samples averaged."
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to register user: {str(e)}"}), 500

@app.route("/attendance", methods=["POST"])
def mark_attendance():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files["audio"]
    manual_name = request.form.get("name", "").strip()
    challenge = request.form.get("challenge", "").strip().lower()
    session_id = request.form.get("session_id", "").strip()
    temp_path = "temp_attendance.wav"
    
    import time
    import re
    
    # 0. Session Validation
    if not session_id or session_id not in active_sessions:
        return jsonify({"error": "No active session. Please scan QR code.", "verified": False}), 403
        
    session = active_sessions[session_id]
    if time.time() - session["created_at"] > SESSION_EXPIRY + 60: # Extra grace period
        return jsonify({"error": "Session expired. Please scan new QR.", "verified": False}), 403
        
    m_name_lower = manual_name.lower()
    if m_name_lower in session["disqualified"]:
        return jsonify({"error": "Disqualified: Session terminated due to focus loss.", "verified": False}), 403
        
    if m_name_lower in session["used_by"]:
        return jsonify({"error": "Attendance already marked for this session.", "verified": False}), 403

    try:
        print(f"DEBUG: Audio received for {manual_name}. Session: {session_id}")
        audio_file.save(temp_path)
        
        # 1. Speech-to-Text Validation
        recognizer = sr.Recognizer()
        text = ""
        try:
            with sr.AudioFile(temp_path) as source:
                audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data).lower()
                print(f"DEBUG: Recognized text: '{text}'")
                print(f"DEBUG: Expected challenge: '{challenge}'")
        except Exception as sr_err:
            print(f"DEBUG: STT failed: {str(sr_err)}")
            return jsonify({"error": "Speech not clear. Try again.", "verified": False}), 400

        # 2. Identify student
        students = load_students()
        target_student = None
        
        ident_name = manual_name if manual_name else text
        for student in students:
            if student["name"].lower() in ident_name.lower():
                target_student = student
                break
        
        if not target_student:
             return jsonify({
                "verified": False,
                "message": "Student not identified. Please register.",
                "text": text
            }), 404

        # 3. Anti-Spoof Challenge Check (Flex Match)
        import re
        def clean_text(t):
            return re.sub(r'[^\w\s]', '', t.lower()).strip()
            
        c_clean = clean_text(challenge)
        t_clean = clean_text(text)
        
        if c_clean and c_clean not in t_clean:
            print(f"DEBUG: Challenge mismatch. Expected '{c_clean}' to be part of '{t_clean}'")
            target_student["failed_attempts"] += 1
            save_students(students)
            return jsonify({
                "verified": False,
                "message": f"Security challenge failed. Please say: '{challenge}'",
                "text": text
            }), 403
        else:
            print(f"DEBUG: Challenge verified successfully.")

        # 4. Voice Biometric Verification
        print(f"DEBUG: Processing voice biometrics for {target_student['name']}...")
        wav = preprocess_wav(temp_path)
        new_embedding = encoder.embed_utterance(wav)
        
        old_embedding = np.load(target_student["npy_file"])
        similarity = np.dot(old_embedding, new_embedding) / (np.linalg.norm(old_embedding) * np.linalg.norm(new_embedding))
        similarity = float(similarity)
        
        print(f"DEBUG: User similarity: {similarity:.4f}")

        # 5. Suspicious Detection Logic
        is_suspicious = (similarity < 0.60) or (target_student["failed_attempts"] >= 2)
        
        if similarity >= SIMILARITY_THRESHOLD:
            # SUCCESS
            msg = f"Attendance marked for {target_student['name']}."
            target_student["failed_attempts"] = 0
            
            # Update Session state
            session["used_by"].add(m_name_lower)
            
            # 6. Adaptive Learning (Moving Average)
            if similarity > 0.80:
                print(f"DEBUG: Updating embedding (Adaptive Learning)...")
                updated_embedding = (old_embedding + new_embedding) / 2
                np.save(target_student["npy_file"], updated_embedding)
                msg += " (Model accuracy improved)"
            
            save_students(students)
            if os.path.exists(temp_path): os.remove(temp_path)
            
            return jsonify({
                "verified": True,
                "similarity": similarity,
                "text": text,
                "message": msg
            })
        else:
            # FAILURE
            target_student["failed_attempts"] += 1
            save_students(students)
            
            if is_suspicious:
                 return jsonify({
                    "verified": False,
                    "status": "rejected",
                    "message": "Suspicious activity detected.",
                    "similarity": similarity,
                    "text": text
                }), 403
            
            return jsonify({
                "verified": False,
                "message": "Voice mismatch. Please try again.",
                "similarity": similarity,
                "text": text
            }), 401
            
    except sr.UnknownValueError:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": "Speech was not understood"}), 400
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

@app.route("/murf-response", methods=["POST"])
def generate_voice():
    data = request.json
    text = data.get("text", "")
    
    if not MURF_API_KEY:
        return jsonify({"error": "MURF_API_KEY is not set"}), 500
        
    url = "https://api.murf.ai/v1/speech/generate"
    
    payload = {
        "voiceId": "en-US-marcus",
        "style": "Conversational",
        "text": text,
        "rate": 0,
        "pitch": 0,
        "sampleRate": 24000,
        "format": "MP3",
        "channelType": "MONO"
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": MURF_API_KEY
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        res_data = response.json()
        audio_url = res_data.get("audioFile")
        return jsonify({"audio_url": audio_url})
    except Exception as e:
        return jsonify({"error": f"Murf API Error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
