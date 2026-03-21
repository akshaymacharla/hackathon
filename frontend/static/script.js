// -----------------------
// Deployment Config
// -----------------------
const BACKEND_URL = "https://YOUR_BACKEND_URL"; // REPLACE THIS AFTER DEPLOYING TO RENDER

document.addEventListener('DOMContentLoaded', () => {
    // -----------------------
    // UI Elements
    // -----------------------
    const tabsContainer = document.querySelector('.tabs-container');
    const tabAttendance = document.getElementById('tab-attendance');
    const tabRegister = document.getElementById('tab-register');
    const sectionAttendance = document.getElementById('section-attendance');
    const sectionRegister = document.getElementById('section-register');

    // Registration Elements
    const registerNameInput = document.getElementById('register-name');
    const registerRecordBtn = document.getElementById('register-record-btn');
    const registerSubmitBtn = document.getElementById('register-submit-btn');

    // Attendance Elements
    const attendanceNameInput = document.getElementById('attendance-name');
    const attendanceRecordBtn = document.getElementById('attendance-record-btn');
    const attendanceSubmitBtn = document.getElementById('attendance-submit-btn');
    const challengeContainer = document.getElementById('challenge-container');
    const challengeText = document.getElementById('challenge-text');

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
    
    // QR & Session Elements
    const btnStudentView = document.getElementById('btn-student-view');
    const btnTeacherView = document.getElementById('btn-teacher-view');
    const sectionQRScan = document.getElementById('section-qr-scan');
    const sectionTeacher = document.getElementById('section-teacher');
    const startScanBtn = document.getElementById('start-scan-btn');
    const readerContainer = document.getElementById('reader-container');
    const qrCodeContainer = document.getElementById('qrcode');
    const startSessionBtn = document.getElementById('start-session-btn');
    const sessionLabel = document.getElementById('session-label');
    const disqualifiedOverlay = document.getElementById('disqualified-overlay');

    // -----------------------
    // State & Audio Objects
    // -----------------------
    let isRecording = false;
    let isProcessing = false;
    let lastRecordedBlob = null;
    let currentMode = 'attendance';
    let currentChallenge = "";
    
    let audioContext;
    let processor;
    let source;
    let analyser;
    let recordingBuffer = [];
    let animationId;
    let recordingTimer;
    let regSamples = []; 
    
    // QR & Session State
    let currentSessionId = null;
    let html5QrCode = null;
    let isDisqualified = false;
    let isSessionActive = false; // New flag to prevent false triggers
    let qrGen = null;

    // Load initial challenge
    fetchNewChallenge();

    async function fetchNewChallenge() {
        try {
            const res = await fetch(`${BACKEND_URL}/get-challenge`);
            const data = await res.json();
            currentChallenge = data.challenge;
            if (challengeText) {
                challengeText.textContent = `"${currentChallenge}"`;
                challengeContainer.classList.remove('hidden');
                gsap.fromTo(challengeContainer, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4 });
            }
        } catch (err) {
            console.error("DEBUG: Failed to fetch challenge:", err);
        }
    }

    // Fix Initial Canvas Sizing
    function resizeCanvas() {
        if (!canvasContainer) return;
        canvas.width = canvasContainer.clientWidth;
        canvas.height = canvasContainer.clientHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // -----------------------
    // Animations & Tab Logic
    // -----------------------
    function switchTab(mode) {
        if (currentMode === mode || isRecording || isProcessing) return;
        currentMode = mode;
        console.log(`DEBUG: Switched to ${mode} mode`);
        
        hideResults();
        resetCurrentFlow();
        
        if (mode === 'attendance') {
            tabAttendance.classList.add('active');
            tabRegister.classList.remove('active');
            tabsContainer.setAttribute('data-active', 'attendance');
            fetchNewChallenge(); // Get fresh challenge
            
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

    function resetCurrentFlow() {
        lastRecordedBlob = null;
        regSamples = [];
        registerSubmitBtn.disabled = true;
        attendanceSubmitBtn.disabled = true;
        resultsContainer.classList.remove('suspicious-alert');
        showStatus('Waiting for input', false);
    }

    tabAttendance.addEventListener('click', () => switchTab('attendance'));
    tabRegister.addEventListener('click', () => switchTab('register'));

    // View Switcher logic
    btnStudentView.addEventListener('click', () => {
        btnStudentView.classList.add('active');
        btnTeacherView.classList.remove('active');
        sectionTeacher.classList.add('hidden');
        if (!currentSessionId) {
            sectionQRScan.classList.remove('hidden');
            sectionAttendance.classList.add('hidden');
            sectionRegister.classList.add('hidden');
        } else {
             switchTab('attendance');
        }
    });

    btnTeacherView.addEventListener('click', () => {
        btnTeacherView.classList.add('active');
        btnStudentView.classList.remove('active');
        sectionTeacher.classList.remove('hidden');
        sectionQRScan.classList.add('hidden');
        sectionAttendance.classList.add('hidden');
        sectionRegister.classList.add('hidden');
    });

    // -----------------------
    // Teacher Session Logic
    // -----------------------
    startSessionBtn.addEventListener('click', async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/start-session`, { method: 'POST' });
            const data = await res.json();
            currentSessionId = data.session_id;
            sessionLabel.textContent = `Session ID: ${currentSessionId}`;
            
            // Generate QR
            qrCodeContainer.innerHTML = "";
            qrGen = new QRCode(qrCodeContainer, {
                text: currentSessionId,
                width: 256,
                height: 256
            });
            console.log("DEBUG: Teacher session started:", currentSessionId);
        } catch (err) {
            console.error("DEBUG: Failed to start session:", err);
        }
    });

    // -----------------------
    // Student QR Scan Logic
    // -----------------------
    startScanBtn.addEventListener('click', () => {
        readerContainer.classList.remove('hidden');
        startScanBtn.classList.add('hidden');
        
        html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess
        ).catch(err => {
            console.error("DEBUG: QR Scanner failed:", err);
            alert("Camera access denied or error.");
        });
    });

    function onScanSuccess(decodedText, decodedResult) {
        console.log(`DEBUG: QR Scanned: ${decodedText}`);
        currentSessionId = decodedText.trim();
        
        if (html5QrCode) {
            html5QrCode.stop().then(() => {
                readerContainer.classList.add('hidden');
                sectionQRScan.classList.add('hidden');
                
                // Activate session state
                isSessionActive = true; 
                
                switchTab('attendance');
                
                // Delay focus mode slightly to avoid race conditions on view switch
                setTimeout(startFocusMode, 1000);
            });
        }
    }

    // -----------------------
    // Focus Locking logic
    // -----------------------
    function startFocusMode() {
        console.log("DEBUG: Focus mode active. Leave-at-your-own-risk.");
        window.addEventListener('blur', handleDisqualification);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) handleDisqualification();
        });
    }

    async function handleDisqualification() {
        // Only trigger if session is active and user is not already disqualified
        if (!isSessionActive || isDisqualified || !currentSessionId) return;
        isDisqualified = true;
        
        const name = attendanceNameInput.value.trim() || "Anonymous Student";
        console.warn("DEBUG: Disqualification triggered for", name);
        
        disqualifiedOverlay.classList.remove('hidden');
        gsap.fromTo(disqualifiedOverlay, { opacity: 0 }, { opacity: 1, duration: 0.5 });

        // Inform Backend
        try {
            await fetch(`${BACKEND_URL}/api/disqualify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId, name: name })
            });
        } catch (err) {
            console.error("DEBUG: Failed to notify disqualification");
        }
    }

    // -----------------------
    // Recording Logic
    // -----------------------

    registerRecordBtn.addEventListener('click', () => {
        const name = registerNameInput.value.trim();
        if (!name) {
            console.log("DEBUG: Registration failed - Name input empty");
            gsap.to(registerNameInput, { x: 10, duration: 0.05, yoyo: true, repeat: 5 });
            alert("Please enter your name first.");
            return;
        }
        startRecordingMode();
    });

    attendanceRecordBtn.addEventListener('click', () => {
        const name = attendanceNameInput.value.trim();
        if (!name) {
            console.log("DEBUG: Attendance failed - Name input empty");
            gsap.to(attendanceNameInput, { x: 10, duration: 0.05, yoyo: true, repeat: 5 });
            alert("Please enter your name first.");
            return;
        }
        startRecordingMode();
    });

    registerSubmitBtn.addEventListener('click', () => {
        if (!lastRecordedBlob) return;
        processRegistration(lastRecordedBlob);
    });

    attendanceSubmitBtn.addEventListener('click', () => {
        if (!lastRecordedBlob) return;
        processAttendance(lastRecordedBlob);
    });

    async function startRecordingMode() {
        if (isRecording || isProcessing) return;
        hideResults();
        
        try {
            console.log("DEBUG: Requesting microphone access...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            source = audioContext.createMediaStreamSource(stream);
            
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            recordingBuffer = [];

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            
            source.connect(analyser);
            source.connect(processor);
            processor.connect(audioContext.destination);

            processor.onaudioprocess = function(e) {
                if (!isRecording) return;
                recordingBuffer.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            };
            
            isRecording = true;
            lastRecordedBlob = null;
            
            // UI State
            const activeRecordBtn = currentMode === 'register' ? registerRecordBtn : attendanceRecordBtn;
            const activeSubmitBtn = currentMode === 'register' ? registerSubmitBtn : attendanceSubmitBtn;
            
            activeRecordBtn.classList.add('recording');
            activeRecordBtn.querySelector('.btn-text').textContent = 'Recording...';
            activeSubmitBtn.disabled = true;
            
            canvasContainer.classList.add('active');
            resizeCanvas();
            drawVisualizer();
            
            const duration = currentMode === 'register' ? 5000 : 3000;
            const statusMsg = currentMode === 'register' ? `Recording Sample ${regSamples.length + 1} of 3...` : 'Recording Attendance...';
            showStatus(statusMsg, false);
            
            console.log(`DEBUG: Recording started for ${duration/1000}s`);
            
            recordingTimer = setTimeout(() => {
                stopRecordingMode();
            }, duration);

        } catch (err) {
            console.error('DEBUG: Microphone error:', err);
            alert('Microphone error: ' + err.message);
        }
    }

    function stopRecordingMode() {
        if (!isRecording) return;
        isRecording = false;
        
        const activeRecordBtn = currentMode === 'register' ? registerRecordBtn : attendanceRecordBtn;
        const activeSubmitBtn = currentMode === 'register' ? registerSubmitBtn : attendanceSubmitBtn;
        
        activeRecordBtn.classList.remove('recording');
        activeRecordBtn.querySelector('.btn-text').textContent = 'Record Voice';
        
        cancelAnimationFrame(animationId);
        canvasContainer.classList.remove('active');
        
        if (processor) processor.disconnect();
        if (analyser) analyser.disconnect();
        if (source) {
            source.disconnect();
            source.mediaStream.getTracks().forEach(track => track.stop());
        }

        console.log("DEBUG: Encoding WAV...");
        lastRecordedBlob = encodeWAV(recordingBuffer, audioContext.sampleRate);
        
        if (currentMode === 'register') {
            regSamples.push(lastRecordedBlob);
            if (regSamples.length < 3) {
                showStatus(`${regSamples.length} of 3 complete. Record next.`, false);
                activeSubmitBtn.disabled = true;
            } else {
                showStatus('3 of 3 complete. Ready to Register!', false);
                activeSubmitBtn.disabled = false;
            }
        } else {
            showStatus('Recording complete', false);
            activeSubmitBtn.disabled = false;
        }
        console.log("DEBUG: Recording stored. Success status updated.");
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
            const grad = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
            grad.addColorStop(0, '#8b5cf6');
            grad.addColorStop(1, '#3b82f6');
            canvasCtx.fillStyle = grad;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
            x += barWidth;
        }
    }

    // -----------------------
    // API Helpers
    // -----------------------

    async function processRegistration() {
        if (isProcessing || regSamples.length < 3) return;
        isProcessing = true;
        
        const name = registerNameInput.value.trim();
        const formData = new FormData();
        // Append all 3 samples
        regSamples.forEach((blob, i) => {
            formData.append('audio', blob, `sample_${i}.wav`);
        });
        formData.append('name', name);

        try {
            showStatus('Processing...', true);
            registerSubmitBtn.disabled = true;
            
            console.log(`DEBUG: Registering ${name}...`);
            const res = await fetch(`${BACKEND_URL}/register`, { method: 'POST', body: formData });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            
            showResults('— (Registered)', data.message, true, "1.000");
            showStatus('Completed', false);
            setTimeout(hideStatus, 2000);
            registerNameInput.value = '';
            regSamples = [];
            lastRecordedBlob = null;
        } catch (err) {
            console.error("DEBUG: Reg Error:", err);
            showResults('—', 'Error: ' + err.message, false, "0.000");
            hideStatus();
            registerSubmitBtn.disabled = false;
        } finally {
            isProcessing = false;
        }
    }

    async function processAttendance(blob) {
        if (isProcessing) return;
        isProcessing = true;
        
        const name = attendanceNameInput.value.trim();
        const formData = new FormData();
        formData.append('audio', blob, 'attendance.wav');
        formData.append('name', name);
        formData.append('challenge', currentChallenge);
        formData.append('session_id', currentSessionId);

        try {
            showStatus('Processing...', true);
            attendanceSubmitBtn.disabled = true;
            
            console.log("DEBUG: Verifying attendance...");
            const verifyRes = await fetch(`${BACKEND_URL}/attendance`, { method: 'POST', body: formData });
            const verifyData = await verifyRes.json();
            
            // Handle suspicious detection
            if (verifyData.status === 'rejected') {
                resultsContainer.classList.add('suspicious-alert');
                showResults(verifyData.text || '—', verifyData.message, false, (verifyData.similarity || 0).toFixed(3));
                showStatus('Suspicious Activity!', false);
            } else {
                if (!verifyRes.ok && verifyData.verified === false) {
                     showResults(verifyData.text || '—', verifyData.message, false, (verifyData.similarity || 0).toFixed(3));
                } else if (!verifyRes.ok) {
                    throw new Error(verifyData.error || 'Verification failed');
                } else {
                    showResults(verifyData.text || '...', verifyData.message, verifyData.verified, (verifyData.similarity || 0).toFixed(3));
                }
            }
            
            // Speak the response
            if (verifyData.message) {
                const ttsRes = await fetch(`${BACKEND_URL}/murf-response`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: verifyData.message })
                });
                const ttsData = await ttsRes.json();
                if (ttsData.audio_url) {
                    audioPlayer.src = ttsData.audio_url;
                    audioPlayer.play();
                }
            }
            
            showStatus('Completed', false);
            setTimeout(hideStatus, 2000);
            lastRecordedBlob = null;
            
            // Always get a new challenge for next time
            fetchNewChallenge();
            
        } catch (err) {
            console.error("DEBUG: Att Error:", err);
            showResults('—', 'Error: ' + err.message, false, "0.000");
            hideStatus();
            attendanceSubmitBtn.disabled = false;
        } finally {
            isProcessing = false;
        }
    }

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

    function showStatus(text, showSpinner) {
        statusDisplay.classList.remove('hidden');
        statusText.textContent = text;
        statusDisplay.querySelector('.fancy-spinner').style.display = showSpinner ? 'block' : 'none';
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
        const targetObj = { val: 0 };
        gsap.to(targetObj, {
            val: parseFloat(scoreStr),
            duration: 1.5,
            ease: "circ.out",
            onUpdate: function() { similarityScoreText.textContent = targetObj.val.toFixed(3); }
        });
        const threshold = 0.65; // Matches backend
        if (parseFloat(scoreStr) >= threshold || currentMode === 'register') {
            similarityScoreText.style.background = 'linear-gradient(135deg, var(--success) 0%, #34d399 100%)';
        } else {
            similarityScoreText.style.background = 'linear-gradient(135deg, var(--error) 0%, #f87171 100%)';
        }
        similarityScoreText.style.webkitBackgroundClip = 'text';
        similarityScoreText.style.webkitTextFillColor = 'transparent';
        feedbackBox.className = 'feedback-banner ' + (isSuccess ? 'success' : 'error');
        feedbackIcon.innerHTML = isSuccess ? '✓' : '✗';
        feedbackTitle.textContent = isSuccess ? 'Verification Passed' : 'Verification Failed';
        feedbackText.textContent = message;
        gsap.fromTo(resultsContainer, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" });
    }

    function hideResults() {
        resultsContainer.classList.add('hidden');
        resultsContainer.style.opacity = '0';
    }

    // Initial Status
    showStatus('Waiting for input', false);
});
