const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const retakeBtn = document.getElementById('reset-button'); // Renamed logic
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');
let streamTrack = null;

window.onload = () => {
    startCamera();
    initGPS(); // Only runs once on initial load
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
            // Attempting "Low Power" torch if browser supports it
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
        addLog("Analyzing Receipt...");
        processOCR(canvas);
    }, 1000); 
});

async function processOCR(canvas) {
    const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
    
    // The "5 to $" OCR fix
    const cleanedText = text.replace(/[$S5](\d+\.\d{2})/g, '$1'); 
    const priceRegex = /\d+[.,]\d{2}/g;
    const matches = cleanedText.match(priceRegex);

    if (matches) {
        const prices = matches.map(m => parseFloat(m.replace(',', '.')));
        const total = Math.max(...prices);
        
        document.getElementById('scanned-number').innerText = `${total} ${awaySelect.value}`;
        await convertCurrency(total);
        runGeminiCheck(text, total, awaySelect.value);
    } else {
        addLog("No price found. Tap RETAKE to try again.");
    }
}

async function runGeminiCheck(rawText, total, currency) {
    if (!API_KEYS.GEMINI_KEY) {
        addLog("AI Error: Check config.js for GEMINI_KEY");
        return;
    }

    addLog("Gemini: Performing Sanity Check...");
    const promptText = `Analyze receipt: "${rawText}". Total: ${total} ${currency}. Math check? 1 short sentence.`;

    try {
        // Stable 2026 endpoint for Google Cloud keys
const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEYS.GEMINI_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': API_KEYS.GEMINI_KEY // Passing key in header for better auth
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        const data = await response.json();

        if (data.error) {
            // Detailed debugging for you
            addLog(`Auth Note: ${data.error.status} - ${data.error.message}`);
            console.log("Full Error Object:", data.error);
        } else if (data.candidates) {
            const advice = data.candidates[0].content.parts[0].text;
            document.getElementById('latest-message').innerHTML = `<span style="color:#fbbf24; font-weight:bold;">GEMINI:</span> ${advice}`;
        }
    } catch (err) { 
        addLog("AI: Check failed. See browser console."); 
    }
}

async function convertCurrency(amount) {
    const away = awaySelect.value;
    const home = homeSelect.value;
    try {
        const url = `https://v6.exchangerate-api.com/v6/${API_KEYS.CURRENCY_KEY}/latest/${away}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.result === "success") {
            const rate = data.conversion_rates[home];
            const result = (amount * rate).toFixed(2);
            document.getElementById('usd-total').innerText = `${result} ${home}`;
            document.getElementById('current-rate').innerText = rate.toFixed(4);
            document.getElementById('rate-away').innerText = away;
            document.getElementById('rate-home').innerText = home;
        }
    } catch (err) { addLog("Rate API Error."); }
}

// THE NEW RETAKE LOGIC
retakeBtn.addEventListener('click', () => {
    // Clear the data but do NOT reload the page
    document.getElementById('scanned-number').innerText = "--";
    document.getElementById('usd-total').innerText = "--";
    addLog("Camera Restarting...");
    startCamera(); // Restarts video without changing dropdowns
});

function addLog(msg) { document.getElementById('latest-message').innerText = msg; }
function checkCurrencyMatch() { captureBtn.classList.toggle('disabled-btn', awaySelect.value === homeSelect.value); }

awaySelect.addEventListener('change', checkCurrencyMatch);
homeSelect.addEventListener('change', checkCurrencyMatch);