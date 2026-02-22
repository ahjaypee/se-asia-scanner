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

// 2. Camera Initialization
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, 
            audio: false 
        });
        video.srcObject = stream;
        video.play();
        addLog("Camera Connected");
    } catch (err) {
        addLog("Camera Error: Check Permissions");
        console.error(err);
    }
}

// 3. Event Log Manager
function addLog(msg) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logEntry = `[${now}] ${msg}`;
    
    // Update the primary visible message
    document.getElementById('latest-message').innerText = msg;
    
    // Add to internal history (keep last 10)
    eventLog.unshift(logEntry);
    if (eventLog.length > 10) eventLog.pop();
    
    // Build the history HTML
    const historyBox = document.getElementById('log-history');
    historyBox.innerHTML = eventLog.map(entry => `<div class="log-entry">${entry}</div>`).join('');
}

// 4. Safety Check: Disable Scan if currencies match
function checkCurrencyMatch() {
    const isSame = awaySelect.value === homeSelect.value;
    captureBtn.classList.toggle('disabled-btn', isSame);
    
    if (isSame) {
        addLog("Match Error: Set different currencies");
    } else {
        addLog(`Ready: ${awaySelect.value} to ${homeSelect.value}`);
    }
}

awaySelect.addEventListener('change', checkCurrencyMatch);
homeSelect.addEventListener('change', checkCurrencyMatch);

// 5. The Shutter (Scan) Trigger
captureBtn.addEventListener('click', async () => {
    // Tactile Feedback (Like your Z8 shutter)
    if (navigator.vibrate) navigator.vibrate(50);
    
    addLog("Scanning Receipt...");
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // OCR Processing
    Tesseract.recognize(canvas, 'eng').then(({ data: { text } }) => {
        const priceRegex = /\d+[.,]\d{2}/g;
        const matches = text.match(priceRegex);

        if (matches) {
            // Pick the largest number (usually the total)
            const total = Math.max(...matches.map(m => parseFloat(m.replace(',', '.'))));
            document.getElementById('scanned-number').innerText = total;
            addLog(`Price Found: ${total} ${awaySelect.value}`);
            convertCurrency(total);
        } else {
            addLog("OCR Failure: No price detected");
        }
    }).catch(err => {
        addLog("OCR Error: Try again");
        console.error(err);
    });
});

// 6. Currency Conversion Logic
async function convertCurrency(amount) {
    const away = awaySelect.value;
    const home = homeSelect.value;
    
    addLog("Updating Exchange Rates...");

    try {
        const url = `https://v6.exchangerate-api.com/v6/${API_KEYS.CURRENCY_KEY}/latest/${away}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.result === "success") {
            const rate = data.conversion_rates[home];
            const result = (amount * rate).toFixed(2);
            
            // Update Displays
            document.getElementById('usd-total').innerText = result;
            document.getElementById('current-rate').innerText = rate.toFixed(2); // 2 decimal places as requested
            document.getElementById('rate-away').innerText = away;
            document.getElementById('rate-home').innerText = home;

            addLog(`Success: ${amount} ${away} = ${result} ${home}`);
            
            // Next Step: AI Sanity Check would go here
        } else {
            addLog("API Error: Check Connection");
        }
    } catch (err) {
        addLog("Network Error: Conversion Failed");
        console.error(err);
    }
}

// 7. Reset Dashboard
document.getElementById('reset-button').addEventListener('click', () => {
    document.getElementById('scanned-number').innerText = "--";
    document.getElementById('usd-total').innerText = "--";
    document.getElementById('current-rate').innerText = "--";
    addLog("Dashboard Reset");
});