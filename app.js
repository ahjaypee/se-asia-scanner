const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const retakeBtn = document.getElementById('reset-button');
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');
const scannedInput = document.getElementById('scanned-input');
let streamTrack = null;

window.onload = () => {
    startCamera();
    initGPS();
    checkCurrencyMatch();
};

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", focusMode: "continuous" }, audio: false 
        });
        video.srcObject = stream;
        streamTrack = stream.getVideoTracks()[0];
        video.onloadedmetadata = () => video.play();
        video.style.display = "block";
        addLog("Camera Live");
    } catch (err) { addLog("Camera Access Denied"); }
}

function initGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            // Detection for Eastern Shore / MD area
            if (lat > 37 && lat < 41 && lon > -78 && lon < -74) {
                awaySelect.value = "USD";
                addLog("GPS: Maryland detected. Set to USD.");
            } else {
                addLog("Abroad? Please select Local Currency.");
            }
        });
    }
}

captureBtn.addEventListener('click', async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    addLog("Lighting & Focusing...");

    if (streamTrack && streamTrack.getCapabilities().torch) {
        try {
            await streamTrack.applyConstraints({ 
                advanced: [{ torch: true, fillLightMode: "flash" }] 
            });
        } catch (e) { console.log("Torch constraint not met"); }
    }

    setTimeout(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (streamTrack) {
            try {
                await streamTrack.applyConstraints({ advanced: [{ torch: false }] });
            } catch(e){}
            streamTrack.stop();
            video.style.display = "none";
        }
        
        // Convert canvas directly to Base64 for Gemini
        const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
        addLog("Analyzing Receipt...");
        analyzeReceipt(base64Image);
        
    }, 1000); 
});

async function analyzeReceipt(base64Image) {
    if (!API_KEYS.GEMINI_KEY) {
        addLog("AI Error: Check config.js for GEMINI_KEY");
        return;
    }

    const promptText = `Analyze this receipt. Return ONLY a JSON object with two keys:
    1. 'total': the final total amount to pay (as a number).
    2. 'advice': A very short 1-sentence observation about the receipt (e.g., 'Looks like a coffee shop.' or 'Includes 10% tax.').`;

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

        // Populate the manual input field so the user can edit it if needed
        scannedInput.value = result.total;
        
        document.getElementById('latest-message').innerHTML = `<span style="color:#fbbf24; font-weight:bold;">GEMINI:</span> ${result.advice}`;
        
        // Trigger the currency conversion automatically
        convertCurrency(result.total);

    } catch (err) {
        console.error("Extraction Error:", err);
        addLog("AI couldn't read receipt. Enter amount manually.");
        document.getElementById('latest-message').innerHTML = `<span style="color:#f87171; font-weight:bold;">SYSTEM:</span> Tap the 'Scanned Amt' box to type manually.`;
    }
}

async function convertCurrency(amount) {
    const away = awaySelect.value;
    const home = homeSelect.value;
    
    if (!amount || isNaN(amount)) return;

    try {
        // Updated to a reliable, free exchange rate API supporting all listed currencies
        const url = `https://open.er-api.com/v6/latest/${away}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.result === "success") {
            const rate = data.rates[home];
            const result = (amount * rate).toFixed(2);
            
            document.getElementById('usd-total').innerText = `${result} ${home}`;
            document.getElementById('current-rate').innerText = rate.toFixed(4);
            document.getElementById('rate-away').innerText = away;
            document.getElementById('rate-home').innerText = home;
        }
    } catch (err) { 
        addLog("Rate API Error. Cannot fetch live currency.");
    }
}

// Manual Fallback: Recalculate if the user types a new number into the input field
scannedInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
        convertCurrency(val);
    } else {
        document.getElementById('usd-total').innerText = "--";
    }
});

retakeBtn.addEventListener('click', () => {
    scannedInput.value = "";
    document.getElementById('usd-total').innerText = "--";
    addLog("Camera Restarting...");
    startCamera();
});

function addLog(msg) { document.getElementById('latest-message').innerText = msg; }
function checkCurrencyMatch() { captureBtn.classList.toggle('disabled-btn', awaySelect.value === homeSelect.value); }

awaySelect.addEventListener('change', checkCurrencyMatch);
homeSelect.addEventListener('change', checkCurrencyMatch);