document.addEventListener('DOMContentLoaded', () => {
    // -----------------------
    // UI Elements
    // -----------------------
    const tabsContainer = document.querySelector('.tabs-container');
    const tabAttendance = document.getElementById('tab-attendance');
    const tabRegister = document.getElementById('tab-register');
    const sectionAttendance = document.getElementById('section-attendance');
    const sectionRegister = document.getElementById('section-register');

    const registerBtn = document.getElementById('register-btn');
    const registerInput = document.getElementById('register-name');
    const regMicIcon = document.getElementById('reg-mic-icon');
    const regBtnText = document.getElementById('reg-btn-text');

    const attStartBtn = document.getElementById('start-btn');
    const attMicIcon = document.getElementById('att-mic-icon');
    const attBtnText = document.getElementById('att-btn-text');

    const statusDisplay = document.getElementById('status-display');
    const statusText = document.getElementById('status-text');
    const resultsContainer = document.getElementById('results');
    const transcriptText = document.getElementById('transcript-text');
    const similarityScoreText = document.getElementById('similarity-score');
    
    const feedbackBox = document.getElementById('feedback-box');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackText = document.getElementById('feedback-text');
    const feedbackIcon = document.getElementById('feedback-icon');
    
    const audioPlayer = document.getElementById('audio-player');
    
    const canvasContainer = document.querySelector('.visualizer-container');
    const canvas = document.getElementById('audio-visualizer');
    const canvasCtx = canvas.getContext('2d');

    // -----------------------
    // State & Audio Objects
    // -----------------------
    let isRecording = false;
    let currentMode = 'attendance'; // Make attendance default visually
    
    let audioContext;
    let processor;
    let source;
    let analyser;
    let recordingBuffer = [];
    let animationId;

    // Fix Initial Canvas Sizing
    function resizeCanvas() {
        canvas.width = canvasContainer.clientWidth;
        canvas.height = canvasContainer.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // -----------------------
    // Animations & Tab Logic
    // -----------------------
    function switchTab(mode) {
        if (currentMode === mode || isRecording) return;
        currentMode = mode;
        
        hideResults();
        
        if (mode === 'attendance') {
            tabAttendance.classList.add('active');
            tabRegister.classList.remove('active');
            tabsContainer.setAttribute('data-active', 'attendance');
            
            gsap.to(sectionRegister, { opacity: 0, y: 10, duration: 0.3, onComplete: () => {
                sectionRegister.classList.add('hidden');
                sectionAttendance.classList.remove('hidden');
                gsap.fromTo(sectionAttendance, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
            }});
        } else {
            tabRegister.classList.add('active');
            tabAttendance.classList.remove('active');
            tabsContainer.setAttribute('data-active', 'register');
            
            gsap.to(sectionAttendance, { opacity: 0, y: 10, duration: 0.3, onComplete: () => {
                sectionAttendance.classList.add('hidden');
                sectionRegister.classList.remove('hidden');
                gsap.fromTo(sectionRegister, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
            }});
        }
    }

    tabAttendance.addEventListener('click', () => switchTab('attendance'));
    tabRegister.addEventListener('click', () => switchTab('register'));

    // -----------------------
    // Recording & Visualizer
    // -----------------------
    registerBtn.addEventListener('click', () => {
        const name = registerInput.value.trim();
        if (!name) {
            gsap.to(registerInput, { x: 10, duration: 0.05, yoyo: true, repeat: 5 }); // Shake animation
            return;
        }
        toggleRecording(registerBtn, regMicIcon, regBtnText, 'Record & Register');
    });

    attStartBtn.addEventListener('click', () => {
        toggleRecording(attStartBtn, attMicIcon, attBtnText, 'Start Attendance');
    });

    async function toggleRecording(btn, iconEl, textEl, originalText) {
        if (isRecording) {
            stopRecording(btn, iconEl, textEl, originalText);
        } else {
            await startRecording(btn, iconEl, textEl);
        }
    }

    async function startRecording(btn, iconEl, textEl) {
        hideResults();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            source = audioContext.createMediaStreamSource(stream);
            
            // Setup Native WAV PCM Recording
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            recordingBuffer = [];

            // Setup Visualizer Analyser
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            
            source.connect(analyser); // For Visualizer
            source.connect(processor); // For PCM Recording
            processor.connect(audioContext.destination);

            processor.onaudioprocess = function(e) {
                if (!isRecording) return;
                const channelData = e.inputBuffer.getChannelData(0);
                recordingBuffer.push(new Float32Array(channelData));
            };
            
            isRecording = true;
            btn.classList.add('recording');
            iconEl.textContent = '⏹';
            textEl.textContent = 'Stop Recording';
            
            canvasContainer.classList.add('active');
            resizeCanvas();
            drawVisualizer(); // Start Canvas loop
            
            showStatus(currentMode === 'register' ? 'Recording your voice sample...' : 'Listening securely...', false);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            showStatus('Microphone access denied', false);
        }
    }

    function stopRecording(btn, iconEl, textEl, originalText) {
        isRecording = false;
        btn.classList.remove('recording');
        iconEl.textContent = '🎤';
        textEl.textContent = originalText;
        
        cancelAnimationFrame(animationId);
        canvasContainer.classList.remove('active');
        
        processor.disconnect();
        analyser.disconnect();
        source.disconnect();
        source.mediaStream.getTracks().forEach(track => track.stop());

        showStatus('Encrypting & analyzing biometrics...', true);
        
        const wavBlob = encodeWAV(recordingBuffer, audioContext.sampleRate);
        
        if (currentMode === 'register') {
            processRegistration(wavBlob);
        } else {
            processAttendance(wavBlob);
        }
    }

    function drawVisualizer() {
        if (!isRecording) return;
        animationId = requestAnimationFrame(drawVisualizer);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] / 2;
            
            // Create gradient
            const grad = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
            grad.addColorStop(0, '#8b5cf6');
            grad.addColorStop(1, '#3b82f6');

            canvasCtx.fillStyle = grad;
            // Center the bars vertically slightly
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

            x += barWidth;
        }
    }

    // -----------------------
    // Backend Integrations
    // -----------------------

    // Standard WAV encoding Math
    function encodeWAV(buffers, sampleRate) {
        let bufferLength = 0;
        for (let i = 0; i < buffers.length; i++) { bufferLength += buffers[i].length; }

        const view = new DataView(new ArrayBuffer(44 + bufferLength * 2));
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + bufferLength * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, bufferLength * 2, true);

        let offset = 44;
        for (let i = 0; i < buffers.length; i++) {
            const buffer = buffers[i];
            for (let j = 0; j < buffer.length; j++) {
                let s = Math.max(-1, Math.min(1, buffer[j]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                offset += 2;
            }
        }
        return new Blob([view], { type: 'audio/wav' });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) { view.setUint8(offset + i, string.charCodeAt(i)); }
    }

    async function processRegistration(blob) {
        const formData = new FormData();
        formData.append('audio', blob, 'register.wav');
        formData.append('name', registerInput.value.trim());

        try {
            showStatus('Extracting Voice Biometrics (Resemblyzer)...', true);
            const res = await fetch('/register', { method: 'POST', body: formData });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            
            showResults('— (Registration Phase)', data.message, true, "1.000");
            hideStatus();
            registerInput.value = ''; 
        } catch (err) {
            showResults('—', 'Error: ' + err.message, false, "0.000");
            hideStatus();
        }
    }

    async function processAttendance(blob) {
        const formData = new FormData();
        formData.append('audio', blob, 'attendance.wav');

        try {
            showStatus('Authenticating Identity...', true);
            
            const verifyRes = await fetch('/attendance', { method: 'POST', body: formData });
            const verifyData = await verifyRes.json();
            
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');
            
            const transcript = verifyData.text || '...';
            const message = verifyData.message;
            const isSuccess = verifyData.verified;
            const simScore = verifyData.similarity || 0;
            
            showResults(transcript, message, isSuccess, simScore.toFixed(3));
            
            showStatus('Formulating Murf AI response...', true);
            const ttsRes = await fetch('/murf-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: message })
            });
            const ttsData = await ttsRes.json();
            
            if (ttsData.audio_url) {
                audioPlayer.src = ttsData.audio_url;
                audioPlayer.play();
            } else if (ttsData.error && ttsData.error.includes("MURF")) {
                feedbackText.innerHTML += "<br><span style='opacity:0.6; font-size: 0.8em; display:block; margin-top: 8px;'>[Murf API Key Required for TTS]</span>";
            }
            
            hideStatus();
            
        } catch (err) {
            showResults('—', 'Authentication Error: ' + err.message, false, "0.000");
            hideStatus();
        }
    }

    // -----------------------
    // UI Helpers (GSAP transitions included)
    // -----------------------
    function showStatus(text, showSpinner) {
        statusDisplay.classList.remove('hidden');
        statusText.textContent = text;
        statusDisplay.querySelector('.fancy-spinner').style.display = showSpinner ? 'block' : 'none';
        
        // Ensure opacity bounce if it was hidden
        gsap.fromTo(statusDisplay, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }

    function hideStatus() {
        gsap.to(statusDisplay, { opacity: 0, duration: 0.2, onComplete: () => {
            statusDisplay.classList.add('hidden');
        }});
    }

    function showResults(transcript, message, isSuccess, scoreStr) {
        resultsContainer.classList.remove('hidden');
        
        transcriptText.textContent = transcript.includes('—') ? transcript : `"${transcript}"`;
        
        // Count Up Animation for Score
        const targetObj = { val: 0 };
        gsap.to(targetObj, {
            val: parseFloat(scoreStr),
            duration: 1.5,
            ease: "circ.out",
            onUpdate: function() {
                similarityScoreText.textContent = targetObj.val.toFixed(3);
            }
        });
        
        if (parseFloat(scoreStr) > 0.75 || currentMode === 'register') {
            similarityScoreText.style.background = 'linear-gradient(135deg, var(--success) 0%, #34d399 100%)';
            similarityScoreText.style.webkitBackgroundClip = 'text';
            similarityScoreText.style.webkitTextFillColor = 'transparent';
        } else {
            similarityScoreText.style.background = 'linear-gradient(135deg, var(--error) 0%, #f87171 100%)';
            similarityScoreText.style.webkitBackgroundClip = 'text';
            similarityScoreText.style.webkitTextFillColor = 'transparent';
        }

        feedbackBox.className = 'feedback-banner ' + (isSuccess ? 'success' : 'error');
        feedbackIcon.innerHTML = isSuccess ? '✓' : '✗';
        feedbackTitle.textContent = isSuccess ? 'Verification Passed' : 'Verification Failed';
        feedbackText.textContent = message;

        // Animate Dashboard in
        gsap.fromTo(resultsContainer, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" });
        gsap.fromTo('.stat-card', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.1, delay: 0.2 });
        gsap.fromTo(feedbackBox, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, delay: 0.5 });
    }

    function hideResults() {
        resultsContainer.classList.add('hidden');
        resultsContainer.style.opacity = '0';
    }
});
