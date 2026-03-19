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

if not os.path.exists(EMBEDDINGS_DIR):
    os.makedirs(EMBEDDINGS_DIR)

print("Loading VoiceEncoder model... (this might take a few seconds)")
encoder = VoiceEncoder()
print("VoiceEncoder loaded successfully.")

def load_students():
    if os.path.exists(STUDENTS_FILE):
        with open(STUDENTS_FILE, "r") as f:
            return json.load(f)
    return []

def save_students(students):
    with open(STUDENTS_FILE, "w") as f:
        json.dump(students, f, indent=2)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/register", methods=["POST"])
def register_student():
    name = request.form.get("name", "").strip()
    if not name:
        return jsonify({"error": "Student name is required"}), 400
        
    if "audio" not in request.files:
        return jsonify({"error": "No voice sample provided"}), 400
        
    audio_file = request.files["audio"]
    temp_path = f"temp_register_{name.replace(' ', '_')}.wav"
    
    try:
        audio_file.save(temp_path)
        
        print(f"Generating embedding for new registration: {name}...")
        wav = preprocess_wav(temp_path)
        embedding = encoder.embed_utterance(wav)
        
        # Save as .npy file
        npy_path = os.path.join(EMBEDDINGS_DIR, f"{name.replace(' ', '_')}.npy")
        np.save(npy_path, embedding)
        print(f"Embedding saved to {npy_path}")
        
        students = load_students()
        
        student_exists = False
        for student in students:
            if student["name"].lower() == name.lower():
                student["npy_file"] = npy_path
                student_exists = True
                break
                
        if not student_exists:
            new_id = str(len(students) + 1)
            students.append({
                "id": new_id,
                "name": name,
                "npy_file": npy_path
            })
            
        save_students(students)
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return jsonify({
            "success": True, 
            "message": f"Student '{name}' registered successfully with real voice biometric."
        })
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Failed to register user: {str(e)}"}), 500

@app.route("/attendance", methods=["POST"])
def mark_attendance():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files["audio"]
    temp_path = "temp_attendance.wav"
    
    try:
        audio_file.save(temp_path)
        
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data).lower()
            
        students = load_students()
        target_student = None
        for student in students:
            if student["name"].lower() in text:
                target_student = student
                break
                
        if not target_student:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({
                "verified": False,
                "text": text,
                "similarity": 0.0,
                "message": "Name not found in speech or database."
            })
            
        print(f"Generating embedding for attendance check...")
        wav = preprocess_wav(temp_path)
        current_embedding = encoder.embed_utterance(wav)
        
        # Load embedding from .npy file
        npy_path = target_student.get("npy_file")
        if not npy_path or not os.path.exists(npy_path):
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({
                "verified": False,
                "text": text,
                "similarity": 0.0,
                "message": f"{target_student['name']} found but has no registered voice sample (.npy missing)."
            })
            
        saved_embedding = np.load(npy_path)
        
        sim = np.dot(current_embedding, saved_embedding) / (np.linalg.norm(current_embedding) * np.linalg.norm(saved_embedding))
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        similarity_score = round(float(sim), 3)
        print(f"Similarity score: {similarity_score}")
        
        if similarity_score > 0.75:
            print("Accepted")
            return jsonify({
                "verified": True,
                "text": text,
                "similarity": similarity_score,
                "message": f"{target_student['name']}, your attendance has been recorded successfully."
            })
        else:
            print("Rejected")
            return jsonify({
                "verified": False,
                "text": text,
                "similarity": similarity_score,
                "message": "Voice not recognized. Please try again or use verification."
            })
            
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
