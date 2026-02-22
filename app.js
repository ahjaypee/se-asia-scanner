const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');

// 1. Camera & GPS Start
window.onload = () => {
    startCamera();
    autoDetectLocation();
    checkCurrencyMatch(); // Initial safety check
};

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, audio: false 
        });
        video.srcObject = stream;
        video.play();
    } catch (err) { console.error(err); }
}

// 2. Location Intelligence
function autoDetectLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            console.log("GPS Location acquired. Mapping to local currency...");
            // Future: Integration with reverse-geocoding API
        });
    }
}

// 3. Safety Check: Dim button if Currencies Match
function checkCurrencyMatch() {
    const isSame = awaySelect.value === homeSelect.value;
    captureBtn.classList.toggle('disabled-btn', isSame);
    if (isSame) {
        document.getElementById('tip-advice').innerText = "Select different Away/Home currencies.";
    } else {
        document.getElementById('tip-advice').innerText = "Ready...";
    }
}

awaySelect.addEventListener('change', checkCurrencyMatch);
homeSelect.addEventListener('change', checkCurrencyMatch);

// 4. The Shutter (Scan)
captureBtn.addEventListener('click', async () => {
    // Haptic feedback (Like a Z8 shutter click)
    if (navigator.vibrate) navigator.vibrate(50);
    
    document.getElementById('tip-advice').innerText = "OCR: Reading Receipt...";
    
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
            convertCurrency(total);
        } else {
            document.getElementById('tip-advice').innerText = "No price found. Adjust angle!";
        }
    });
});

// 5. Currency Logic
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
            
            // Update UI
            document.getElementById('usd-total').innerText = result;
            document.getElementById('home-label').innerText = `${home} Total`;
            
            // Update FYI Rate
            document.getElementById('current-rate').innerText = rate.toFixed(4);
            document.getElementById('rate-away').innerText = away;
            document.getElementById('rate-home').innerText = home;

            // Trigger AI (We'll build this function next!)
            // runAISanityCheck(text, amount, away, home);
        }
    } catch (err) { console.error(err); }
}

// 6. Reset
document.getElementById('reset-button').addEventListener('click', () => {
    document.getElementById('scanned-number').innerText = "--";
    document.getElementById('usd-total').innerText = "--";
    document.getElementById('current-rate').innerText = "--";
    document.getElementById('tip-advice').innerText = "Ready...";
});