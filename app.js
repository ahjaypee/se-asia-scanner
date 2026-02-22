const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');
let streamTrack = null;

window.onload = () => {
    startCamera();
    initGPS(); // Try to set Away currency based on location
};

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", focusMode: "continuous" }, audio: false 
        });
        video.srcObject = stream;
        streamTrack = stream.getVideoTracks()[0];
        video.onloadedmetadata = () => video.play();
        addLog("Camera Ready");
    } catch (err) { addLog("Camera Access Denied"); }
}

// 1. GPS Auto-Set Logic
function initGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            
            // Basic logic: If in the US, set Away to USD. 
            // This is a placeholder for a real Geocoding API.
            if (lat > 24 && lat < 49 && lon > -125 && lon < -66) {
                awaySelect.value = "USD";
                addLog("Location: USA. Set to USD.");
            } else {
                addLog("Abroad? Please select Local Currency.");
            }
        });
    }
}

// 2. The "Long Exposure" Shutter (1-Second Delay)
captureBtn.addEventListener('click', async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    addLog("Lighting & Focusing (1s)...");

    if (streamTrack && streamTrack.getCapabilities().torch) {
        await streamTrack.applyConstraints({ advanced: [{ torch: true }] });
    }

    // Increased to 1000ms for better focus/exposure
    setTimeout(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (streamTrack) {
            await streamTrack.applyConstraints({ advanced: [{ torch: false }] });
            streamTrack.stop();
            video.style.display = "none";
        }
        addLog("Photo Captured. Analyzing...");
        processOCR(canvas);
    }, 1000); 
});

// 3. OCR & AI Call
async function processOCR(canvas) {
    const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
    const priceRegex = /\d+[.,]\d{2}/g;
    const matches = text.match(priceRegex);

    if (matches) {
        const total = Math.max(...matches.map(m => parseFloat(m.replace(',', '.'))));
        document.getElementById('scanned-number').innerText = `${total} ${awaySelect.value}`;
        
        // Run Currency Conversion
        const converted = await convertCurrency(total);
        
        // TRIGGER GEMINI AI SANITY CHECK
        runGeminiCheck(text, total, awaySelect.value);
    } else {
        addLog("OCR Failed. Tap Reset.");
    }
}

async function runGeminiCheck(rawText, total, currency) {
    addLog("Gemini: Checking for hidden fees...");
    
    const prompt = `You are a travel finance expert. Analyze this receipt text: "${rawText}". 
    The total found is ${total} ${currency}. 
    Does this look correct? Mention if taxes/service charges are included. 
    Keep it very brief (2 sentences max).`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEYS.GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();
        const advice = data.candidates[0].content.parts[0].text;
        
        // Display result in the log area
        document.getElementById('latest-message').innerHTML = `<span style="color:#fbbf24">Gemini:</span> ${advice}`;
    } catch (err) {
        addLog("Gemini Check Unavailable.");
    }
}

// ... (Rest of your convertCurrency and Reset functions remain the same) ...

async function convertCurrency(amount) {
    const away = awaySelect.value;
    const home = homeSelect.value;
    const url = `https://v6.exchangerate-api.com/v6/${API_KEYS.CURRENCY_KEY}/latest/${away}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.result === "success") {
        const rate = data.conversion_rates[home];
        const result = (amount * rate).toFixed(2);
        document.getElementById('usd-total').innerText = `${result} ${home}`;
        document.getElementById('current-rate').innerText = rate.toFixed(2);
        return result;
    }
}

document.getElementById('reset-button').addEventListener('click', () => { location.reload(); });
function addLog(msg) { document.getElementById('latest-message').innerText = msg; }