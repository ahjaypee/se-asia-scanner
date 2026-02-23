const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');
const scannedInput = document.getElementById('scanned-input');
const modeChips = document.querySelectorAll('.mode-chip');

let streamTrack = null;
let isCameraActive = false;
let currentScanMode = 'receipt';

window.onload = () => {
    startCamera();
    initGPS();
    checkCurrencyMatch();
};

// Mode Chip Selection Logic
modeChips.forEach(chip => {
    chip.addEventListener('click', () => {
        modeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentScanMode = chip.getAttribute('data-mode');
    });
});

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", focusMode: "continuous" }, audio: false 
        });
        video.srcObject = stream;
        streamTrack = stream.getVideoTracks()[0];
        video.onloadedmetadata = () => video.play();
        video.style.display = "block";
        
        isCameraActive = true;
        captureBtn.innerText = "SCAN";
        scannedInput.value = "";
        document.getElementById('usd-total').innerText = "--";
        addLog("Camera Live. Select mode and scan.");
    } catch (err) { addLog("Camera Access Denied"); }
}

function initGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            if (lat > 37 && lat < 41 && lon > -78 && lon < -74) {
                awaySelect.value = "USD";
                addLog("GPS: Maryland detected. Set to USD.");
            } else {
                addLog("Abroad? Please select Local Currency.");
            }
        });
    }
}

const torchBtn = document.getElementById('torch-button');
let isTorchOn = false;

torchBtn.addEventListener('click', async () => {
    if (streamTrack && streamTrack.getCapabilities().torch) {
        isTorchOn = !isTorchOn;
        try {
            await streamTrack.applyConstraints({ advanced: [{ torch: isTorchOn }] });
            torchBtn.style.background = isTorchOn ? '#fbbf24' : '#475569'; 
        } catch (e) { console.log("Torch constraint error", e); }
    } else {
        addLog("Flashlight not supported on this device.");
    }
});

captureBtn.addEventListener('click', async () => {
    if (!isCameraActive) {
        addLog("Camera Restarting...");
        startCamera();
        return;
    }

    if (navigator.vibrate) navigator.vibrate(50);
    addLog("Analyzing visual data...");

    setTimeout(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (streamTrack) {
            try {
                isTorchOn = false;
                torchBtn.style.background = '#475569';
                await streamTrack.applyConstraints({ advanced: [{ torch: false }] });
            } catch(e){}
            streamTrack.stop();
            video.style.display = "none";
        }
        
        isCameraActive = false;
        captureBtn.innerText = "SCAN AGAIN"; 
        const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
        
        analyzeImage(base64Image);
        
    }, 500); 
});

async function analyzeImage(base64Image) {
    if (!API_KEYS.GEMINI_KEY) {
        addLog("AI Error: Check config.js for GEMINI_KEY");
        return;
    }

    let promptText = "";

    if (currentScanMode === "receipt") {
        promptText = `Analyze this receipt. Return ONLY a JSON object with two keys:
        1. 'total': the final total amount to pay (as a number).
        2. 'advice': Act as a friendly travel companion. Gently note if prices seem reasonable, and make a warm personalized observation about the items bought (perhaps mentioning picking something up for Kate, or fueling up for photography). Keep to 2-3 short, helpful sentences.`;
    } else if (currentScanMode === "menu") {
        promptText = `Analyze this menu. Return ONLY a JSON object with two keys:
        1. 'total': return 0.
        2. 'advice': Act as a knowledgeable local food guide. Identify 1 or 2 standout regional specialties. Keep the user's love of cooking and their wife Kate in mind—maybe suggest a dish she might like or something inspiring to cook later. Comment briefly on whether prices look like standard local rates. Keep to 2-3 short, engaging sentences.`;
    } else if (currentScanMode === "food") {
        promptText = `Analyze this photo of food. Return ONLY a JSON object with two keys:
        1. 'total': return 0.
        2. 'advice': Act as an enthusiastic culinary expert. Identify the dish and its key ingredients. Since the user shoots with a Nikon Z8, maybe compliment the plating or suggest a photography angle, and add a fun fact about the dish's origin. Keep to 2-3 short, mouth-watering sentences.`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEYS.GEMINI_KEY}`;

    const payload = {
        contents: [{
            parts: [
                { text: promptText },
                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
        }],
        generationConfig: { response_mime_type: "application/json" }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        const rawText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(rawText);

        if (result.total > 0) {
            scannedInput.value = result.total;
            convertCurrency(result.total);
        } else {
            scannedInput.value = "";
            document.getElementById('usd-total').innerText = "--";
        }
        
        document.getElementById('latest-message').innerHTML = `<span style="color:#fbbf24; font-weight:normal;">${result.advice}</span>`;

    } catch (err) {
        console.error("Extraction Error:", err);
        document.getElementById('latest-message').innerHTML = `<span style="color:#f87171; font-weight:bold;">SYSTEM:</span> Scan failed. Please try a different angle or lighting.`;
    }
}

async function convertCurrency(amount) {
    const away = awaySelect.value;
    const home = homeSelect.value;
    
    if (!amount || isNaN(amount)) return;

    try {
        const url = `https://open.er-api.com/v6/latest/${away}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.result === "success") {
            const rate = data.rates[home];
            const result = (amount * rate).toFixed(2);
            document.getElementById('usd-total').innerText = `${result} ${home}`;
        }
    } catch (err) { 
        addLog("Rate API Error. Cannot fetch live currency.");
    }
}

scannedInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
        convertCurrency(val);
    } else {
        document.getElementById('usd-total').innerText = "--";
    }
});

function addLog(msg) { 
    document.getElementById('latest-message').innerHTML = `<span class="log-entry latest">${msg}</span>`; 
}

function checkCurrencyMatch() { 
    captureBtn.classList.toggle('disabled-btn', awaySelect.value === homeSelect.value); 
    document.getElementById('scanned-currency').innerText = awaySelect.value;
}

awaySelect.addEventListener('change', checkCurrencyMatch);
homeSelect.addEventListener('change', checkCurrencyMatch);