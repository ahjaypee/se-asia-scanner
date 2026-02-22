const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');

let eventLog = [];

// 1. Startup Logic
window.onload = () => {
    startCamera();
    checkCurrencyMatch();
    addLog("System Ready");
};

// 2. Camera Initialization (Enhanced for Mobile)
async function startCamera() {
    addLog("Attempting Camera Access...");
    try {
        const constraints = { 
            video: { 
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }, 
            audio: false 
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Essential for iOS Portrait mode
        video.srcObject = stream;
        video.setAttribute("playsinline", true); 
        video.play();
        
        addLog("Camera Live");
    } catch (err) {
        addLog("Camera Error: Check Permissions");
        console.error("Detailed Camera Error:", err);
    }
}

// 3. Event Log Manager
function addLog(msg) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry = `[${now}] ${msg}`;
    
    document.getElementById('latest-message').innerText = msg;
    
    eventLog.unshift(logEntry);
    if (eventLog.length > 10) eventLog.pop();
    
    const historyBox = document.getElementById('log-history');
    if(historyBox) {
        historyBox.innerHTML = eventLog.map(entry => `<div class="log-entry">${entry}</div>`).join('');
    }
}

// 4. Safety Check
function checkCurrencyMatch() {
    const isSame = awaySelect.value === homeSelect.value;
    captureBtn.classList.toggle('disabled-btn', isSame);
    
    if (isSame) {
        addLog("Error: Currencies Match");
    } else {
        addLog(`Ready: ${awaySelect.value} to ${homeSelect.value}`);
    }
}

awaySelect.addEventListener('change', checkCurrencyMatch);
homeSelect.addEventListener('change', checkCurrencyMatch);

// 5. The Shutter
captureBtn.addEventListener('click', async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    
    addLog("Scanning Receipt...");
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    Tesseract.recognize(canvas, 'eng').then(({ data: { text } }) => {
        const priceRegex = /\d+[.,]\d{2}/g;
        const matches = text.match(priceRegex);

        if (matches) {
            const total = Math.max(...matches.map(m => parseFloat(m.replace(',', '.'))));
            document.getElementById('scanned-number').innerText = total;
            addLog(`Found: ${total} ${awaySelect.value}`);
            convertCurrency(total, text); // Passing text for future AI use
        } else {
            addLog("OCR: No price detected");
        }
    }).catch(err => {
        addLog("OCR: Error reading image");
    });
});

// 6. Currency Conversion
async function convertCurrency(amount, rawText) {
    const away = awaySelect.value;
    const home = homeSelect.value;
    
    addLog("Fetching Rates...");

    try {
        const url = `https://v6.exchangerate-api.com/v6/${API_KEYS.CURRENCY_KEY}/latest/${away}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.result === "success") {
            const rate = data.conversion_rates[home];
            const result = (amount * rate).toFixed(2);
            
            document.getElementById('usd-total').innerText = result;
            document.getElementById('current-rate').innerText = rate.toFixed(2);
            document.getElementById('rate-away').innerText = away;
            document.getElementById('rate-home').innerText = home;

            addLog(`Done: ${result} ${home}`);
        }
    } catch (err) {
        addLog("Network Error");
    }
}

// 7. Reset
document.getElementById('reset-button').addEventListener('click', () => {
    document.getElementById('scanned-number').innerText = "--";
    document.getElementById('usd-total').innerText = "--";
    document.getElementById('current-rate').innerText = "--";
    addLog("Cleared");
});