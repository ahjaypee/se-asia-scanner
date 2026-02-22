const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');
let streamTrack = null;

window.onload = () => {
    startCamera();
    detectHomeBasedOnGPS(); // Auto-select "Away" based on where you are
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
        addLog("Camera Ready");
    } catch (err) { addLog("Camera Error"); }
}

// 1. GPS Detection Logic
async function detectHomeBasedOnGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            addLog("GPS Found: Determining Local Currency...");
            // In a real trip, we would use reverse-geocoding here.
            // For now, if you are in Maryland, let's keep it USD.
            // If the GPS coords are outside the US, we could auto-switch to THB/EUR.
        });
    }
}

// 2. The "Pro" Shutter (With Exposure Delay)
captureBtn.addEventListener('click', async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    addLog("Lighting & Focusing...");

    // Fire the Torch
    if (streamTrack && streamTrack.getCapabilities().torch) {
        await streamTrack.applyConstraints({ advanced: [{ torch: true }] });
    }

    // PHOTOGRAPHY TIP: We wait 600ms now. 
    // This allows the camera's Auto-Exposure (AE) and Auto-Focus (AF) to lock 
    // onto the illuminated receipt so the image isn't a white blur.
    setTimeout(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Snap complete: Turn off hardware
        if (streamTrack) {
            await streamTrack.applyConstraints({ advanced: [{ torch: false }] });
            streamTrack.stop();
            video.style.display = "none";
            addLog("Processing Photo...");
        }

        processOCR(canvas);
    }, 600); 
});

function processOCR(canvas) {
    Tesseract.recognize(canvas, 'eng').then(({ data: { text } }) => {
        const priceRegex = /\d+[.,]\d{2}/g;
        const matches = text.match(priceRegex);

        if (matches) {
            const total = Math.max(...matches.map(m => parseFloat(m.replace(',', '.'))));
            
            // Update UI Labels with currency codes
            document.getElementById('scanned-number').innerText = `${total} ${awaySelect.value}`;
            addLog("Price Found");
            convertCurrency(total, text);
        } else {
            addLog("OCR Failed: No price. Resetting...");
        }
    });
}

async function convertCurrency(amount, rawText) {
    const away = awaySelect.value;
    const home = homeSelect.value;
    try {
        const url = `https://v6.exchangerate-api.com/v6/${API_KEYS.CURRENCY_KEY}/latest/${away}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.result === "success") {
            const rate = data.conversion_rates[home];
            const result = (amount * rate).toFixed(2);
            
            // Display with Currency Code
            document.getElementById('usd-total').innerText = `${result} ${home}`;
            document.getElementById('current-rate').innerText = rate.toFixed(2);
            document.getElementById('rate-away').innerText = away;
            document.getElementById('rate-home').innerText = home;

            // Update Labels
            document.getElementById('away-label-text').innerText = `${away} Total`;
            document.getElementById('home-label-text').innerText = `${home} Equiv`;

            // NEXT: AI Sanity Check
            runAISanityCheck(rawText, result, home);
        }
    } catch (err) { addLog("Conversion Failed"); }
}

// AI Integration Placeholder
async function runAISanityCheck(text, amount, currency) {
    addLog("Gemini is analyzing receipt...");
    // We will build this Gemini call next!
}

document.getElementById('reset-button').addEventListener('click', () => {
    location.reload(); // Simplest way to restart camera and clear variables
});

function addLog(msg) {
    document.getElementById('latest-message').innerText = msg;
}

function checkCurrencyMatch() {
    captureBtn.classList.toggle('disabled-btn', awaySelect.value === homeSelect.value);
}