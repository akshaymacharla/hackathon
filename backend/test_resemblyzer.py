import os
import numpy as np
import argparse

try:
    from resemblyzer import VoiceEncoder, preprocess_wav
except ImportError:
    print("ERROR: Resemblyzer is not installed or failed to load.")
    print("Did you install Microsoft Visual C++ Build Tools and CMake?")
    exit(1)

def test_similarity(file1, file2):
    if not os.path.exists(file1) or not os.path.exists(file2):
        print("ERROR: One or both audio files do not exist.")
        return

    print("Loading VoiceEncoder... (this might take a few seconds)")
    encoder = VoiceEncoder()

    print(f"Generating embedding for {file1}...")
    wav1 = preprocess_wav(file1)
    embed1 = encoder.embed_utterance(wav1)

    print(f"Generating embedding for {file2}...")
    wav2 = preprocess_wav(file2)
    embed2 = encoder.embed_utterance(wav2)

    similarity = np.dot(embed1, embed2) / (np.linalg.norm(embed1) * np.linalg.norm(embed2))
    score = round(float(similarity), 3)

    print(f"\nSimilarity score: {score}")
    if score > 0.75:
        print("Accepted: Voices match!")
    else:
        print("Rejected: Voices do not match.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test Resemblyzer similarity between two audio files.")
    parser.add_argument("file1", help="Path to the first WAV file")
    parser.add_argument("file2", help="Path to the second WAV file")
    args = parser.parse_args()
    
    test_similarity(args.file1, args.file2)
