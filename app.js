const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');
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
        addLog("Camera Ready");
    } catch (err) { addLog("Camera Access Denied"); }
}

function initGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            // Maryland/Eastern Shore detection logic
            if (lat > 37 && lat < 40 && lon > -77 && lon < -75) {
                awaySelect.value = "USD";
                addLog("Location: Maryland. Set to USD.");
            } else {
                addLog("Abroad? Select local currency.");
            }
        });
    }
}

captureBtn.addEventListener('click', async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    addLog("Lighting & Focusing (1s)...");

    if (streamTrack && streamTrack.getCapabilities().torch) {
        await streamTrack.applyConstraints({ advanced: [{ torch: true }] });
    }

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
        addLog("Analyzing Receipt...");
        processOCR(canvas);
    }, 1000); 
});

async function processOCR(canvas) {
    const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
    
    // THE "$ TO 5" FIX: 
    // We look for numbers, but specifically clean up common OCR mistakes 
    // where a leading '$' is read as a '5'.
    const cleanedText = text.replace(/[$S5](\d+\.\d{2})/g, '$1'); 
    const priceRegex = /\d+[.,]\d{2}/g;
    const matches = cleanedText.match(priceRegex);

    if (matches) {
        // Convert to float and pick the highest value
        const prices = matches.map(m => parseFloat(m.replace(',', '.')));
        const total = Math.max(...prices);
        
        document.getElementById('scanned-number').innerText = `${total} ${awaySelect.value}`;
        const converted = await convertCurrency(total);
        
        // Final Step: Ask Gemini to explain the receipt
        runGeminiCheck(text, total, awaySelect.value);
    } else {
        addLog("No price found. Try a closer shot!");
    }
}

async function runGeminiCheck(rawText, total, currency) {
    addLog("Gemini: Analyzing line items...");
    
    // Using a very simple prompt to ensure no character encoding issues
    const promptText = `Receipt text: ${rawText}. Total: ${total} ${currency}. Is the math correct and are there hidden fees? One short sentence only.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEYS.GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: promptText }]
                }]
            })
        });

        const data = await response.json();

        // Check if the API returned an error message (like "Invalid API Key")
        if (data.error) {
            addLog(`AI Error: ${data.error.message}`);
            console.error("Gemini API Error Details:", data.error);
            return;
        }

        if (data.candidates && data.candidates[0].content) {
            const advice = data.candidates[0].content.parts[0].text;
            document.getElementById('latest-message').innerHTML = `<span style="color:#fbbf24; font-weight:bold;">GEMINI:</span> ${advice}`;
        } else {
            addLog("AI: No insight found.");
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        addLog("AI Check: Network or Key Error.");
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
            
            // UPDATE THE FYI ROW LABELS
            document.getElementById('current-rate').innerText = rate.toFixed(4);
            document.getElementById('rate-away').innerText = away;
            document.getElementById('rate-home').innerText = home;

            return result;
        }
    } catch (err) { addLog("Rate API Error"); }
}

document.getElementById('reset-button').addEventListener('click', () => {
    location.reload(); 
});

function addLog(msg) {
    document.getElementById('latest-message').innerText = msg;
}

function checkCurrencyMatch() {
    captureBtn.classList.toggle('disabled-btn', awaySelect.value === homeSelect.value);
}