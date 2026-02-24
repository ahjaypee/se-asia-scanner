const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const torchBtn = document.getElementById('torch-button');
const awaySelect = document.getElementById('away-currency');
const homeSelect = document.getElementById('home-currency');
const scannedInput = document.getElementById('scanned-input');
const modeChips = document.querySelectorAll('.mode-chip');

const currencyPanel = document.getElementById('currency-panel');
const totalsPanel = document.getElementById('totals-panel');
const logContainer = document.getElementById('log-container');

let streamTrack = null;
let isCameraActive = false;
let isProcessing = false;
let currentScanMode = 'receipt';

let clickCount = 0;
let clickTimer;

window.onload = () => {
    loadSettings();
    startCamera();
    updateWorkspace();
};

function saveSettings() {
    localStorage.setItem('tsp_home', homeSelect.value);
    localStorage.setItem('tsp_away', awaySelect.value);
    localStorage.setItem('tsp_mode', currentScanMode);
}

function loadSettings() {
    if (localStorage.getItem('tsp_home')) homeSelect.value = localStorage.getItem('tsp_home');
    if (localStorage.getItem('tsp_away')) awaySelect.value = localStorage.getItem('tsp_away');
    if (localStorage.getItem('tsp_mode')) currentScanMode = localStorage.getItem('tsp_mode');
    
    modeChips.forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-mode') === currentScanMode);
    });
}

function resetTotals() {
    if (scannedInput) scannedInput.value = "";
    const usdTotalEl = document.getElementById('usd-total');
    if (usdTotalEl) {
        usdTotalEl.innerText = "--";
        usdTotalEl.classList.remove('success-pulse');
    }
}

function updateWorkspace() {
    if (currentScanMode === 'receipt') {
        currencyPanel.classList.remove('hidden');
        totalsPanel.classList.remove('hidden');
        logContainer.classList.remove('expanded');
    } else {
        currencyPanel.classList.add('hidden');
        totalsPanel.classList.add('hidden');
        logContainer.classList.add('expanded');
    }
    
    const scannedTag = document.getElementById('scanned-currency-tag');
    if (scannedTag) scannedTag.innerText = awaySelect.value;
    
    const homeTag = document.getElementById('home-currency-tag');
    if (homeTag) homeTag.innerText = homeSelect.value;
    
    resetTotals();
}

modeChips.forEach(chip => {
    chip.addEventListener('click', () => {
        clickCount++;
        
        modeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentScanMode = chip.getAttribute('data-mode');
        saveSettings();
        updateWorkspace();
        
        clearTimeout(clickTimer);
        
        clickTimer = setTimeout(() => {
            clickCount = 0; 
            addLog(`Mode switched to: ${currentScanMode.toUpperCase()}`);
            if (!isCameraActive && !isProcessing) wakeCamera();
        }, 500);

        if (clickCount === 3) {
            clickCount = 0; 
            clearTimeout(clickTimer); 
            triggerHelp(currentScanMode);
        }
    });
});

function triggerHelp(mode) {
    let helpMsg = "";
    if (mode === "receipt") helpMsg = "Goal: Audit expenses. Ensure the receipt is flat and well-lit. Tap SCAN to calculate totals in your Home currency.";
    if (mode === "menu") helpMsg = "Goal: Translate and find specialties. Fill the screen with the menu text. Tap SCAN to get regional recommendations.";
    if (mode === "food") helpMsg = "Goal: Identify a dish. Ensure the plate fills the frame. Tap SCAN to learn about the ingredients and origins.";
    document.getElementById('latest-message').innerHTML = `<span style="color:#38bdf8; font-weight:bold;">HELP:</span> ${helpMsg}`;
}

async function fetchGPSCurrency(targetSelectId, locationName) {
    addLog(`📍 Locating ${locationName}...`);
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.currency) {
            const select = document.getElementById(targetSelectId);
            const exists = Array.from(select.options).some(opt => opt.value === data.currency);
            
            if (exists) {
                select.value = data.currency;
                addLog(`📍 Found you in ${data.country_name}. Set to ${data.currency}.`);
                saveSettings();
                updateWorkspace();
            } else {
                addLog(`📍 Found you in ${data.country_name}, but ${data.currency} is not in your list.`);
            }
        }
    } catch (e) {
        addLog("📍 GPS request failed. Please select manually.");
    }
}

document.getElementById('home-gps').addEventListener('click', () => fetchGPSCurrency('home-currency', 'Home'));
document.getElementById('away-gps').addEventListener('click', () => fetchGPSCurrency('away-currency', 'Away'));

homeSelect.addEventListener('change', () => { saveSettings(); updateWorkspace(); });
awaySelect.addEventListener('change', () => { saveSettings(); updateWorkspace(); });

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", focusMode: "continuous" }, audio: false 
        });
        video.srcObject = stream;
        streamTrack = stream.getVideoTracks()[0];
        video.onloadedmetadata = () => video.play();
        wakeCamera();
    } catch (err) { addLog("Camera Access Denied"); }
}

function wakeCamera() {
    video.play();
    isCameraActive = true;
    captureBtn.classList.remove('error-pulse');
    addLog("Ready. Point and SCAN.");
    resetTotals(); 
}

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
    if (isProcessing) return; 
    
    if (!isCameraActive) {
        wakeCamera();
        return;
    }

    if (navigator.vibrate) navigator.vibrate(50);
    isProcessing = true;
    captureBtn.classList.add('processing-btn');
    addLog("Processing visual data...");

    video.style.opacity = 0.5;
    setTimeout(() => { video.style.opacity = 1; }, 100);

    setTimeout(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        video.pause();
        isCameraActive = false;
        
        if (streamTrack && isTorchOn) {
            try {
                isTorchOn = false;
                torchBtn.style.background = '#475569';
                await streamTrack.applyConstraints({ advanced: [{ torch: false }] });
            } catch(e){}
        }
        
        const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
        analyzeImage(base64Image);
        
    }, 150); 
});

async function analyzeImage(base64Image) {
    if (!API_KEYS.GEMINI_KEY) {
        handleError("AI Error: Check config.js for GEMINI_KEY");
        return;
    }

    let promptText = "";
    if (currentScanMode === "receipt") {
        promptText = `Analyze this receipt. Return ONLY a JSON object with two keys:
        1. 'total': the final total amount to pay (as a number).
        2. 'advice': Act as a professional travel guide. Note if prices seem reasonable. Make a helpful, general observation about the items. Keep to 2 short sentences.`;
    } else if (currentScanMode === "menu") {
        promptText = `Analyze this menu. Return ONLY a JSON object with two keys:
        1. 'total': return 0.
        2. 'advice': Act as an expert culinary guide. Provide a brief introductory sentence. Then, use a bulleted list to highlight 1 or 2 standout regional specialties and suggest what to ask the staff. Conclude with a brief note on price-to-value.`;
    } else if (currentScanMode === "food") {
        promptText = `Analyze this photo of food. Return ONLY a JSON object with two keys:
        1. 'total': return 0.
        2. 'advice': Act as an enthusiastic culinary expert. Identify the dish in a short sentence. Then, use a bulleted list to outline its key ingredients and a fascinating cultural origin or fact.`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEYS.GEMINI_KEY}`;
    const payload = {
        contents: [{
            parts: [{ text: promptText }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }]
        }],
        generationConfig: { response_mime_type: "application/json" }
    };

    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const rawText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(rawText);

        if (currentScanMode === 'receipt' && result.total > 0) {
            scannedInput.value = result.total;
            convertCurrency(result.total);
        } else {
            resetTotals();
        }
        
        const formattedAdvice = result.advice.replace(/\n/g, '<br>');
        
        document.getElementById('latest-message').innerHTML = `<span style="color:#fbbf24; font-weight:normal;">${formattedAdvice}</span>`;
        resetButtonState(false);

    } catch (err) {
        console.error("Extraction Error:", err);
        handleError("Scan failed. Please tap SCAN to wake camera and try a different angle.");
    }
}

function handleError(msg) {
    document.getElementById('latest-message').innerHTML = `<span style="color:#f87171; font-weight:bold;">SYSTEM:</span> ${msg}`;
    resetButtonState(true);
}

function resetButtonState(isError) {
    isProcessing = false;
    captureBtn.classList.remove('processing-btn');
    if (isError) captureBtn.classList.add('error-pulse');
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
            
            const usdTotalEl = document.getElementById('usd-total');
            if (usdTotalEl) {
                usdTotalEl.innerText = result;
                
                usdTotalEl.classList.remove('success-pulse');
                void usdTotalEl.offsetWidth; 
                usdTotalEl.classList.add('success-pulse');
            }
        }
    } catch (err) { addLog("Rate API Error. Cannot fetch live currency."); }
}

scannedInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) convertCurrency(val);
    else {
        const el = document.getElementById('usd-total');
        if (el) el.innerText = "--";
    }
});

function addLog(msg) { document.getElementById('latest-message').innerHTML = `<span class="log-entry latest">${msg}</span>`; }