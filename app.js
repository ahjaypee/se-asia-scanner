const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const awaySelect = document.getElementById('country-selector');
const homeSelect = document.getElementById('home-currency');
let eventLog = [];
let streamTrack = null;

window.onload = () => {
    startCamera();
    checkCurrencyMatch();
};

async function startCamera() {
    addLog("Requesting Camera...");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, audio: false 
        });
        video.srcObject = stream;
        streamTrack = stream.getVideoTracks()[0];
        
        video.onloadedmetadata = () => video.play();
        video.style.display = "block"; // Ensure video is visible
        addLog("Camera Live");
    } catch (err) {
        addLog("Camera Access Denied");
    }
}

// 4. THE SHUTTER (With Torch and Auto-Off)
captureBtn.addEventListener('click', async () => {
    if (navigator.vibrate) navigator.vibrate(50);
    addLog("Capturing...");

    // Try to pulse the Torch
    if (streamTrack && streamTrack.getCapabilities().torch) {
        try {
            await streamTrack.applyConstraints({ advanced: [{ torch: true }] });
        } catch (e) { console.log("Torch failed"); }
    }

    // Short delay for exposure adjustment
    setTimeout(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // TURN OFF TORCH AND CAMERA
        if (streamTrack) {
            try {
                await streamTrack.applyConstraints({ advanced: [{ torch: false }] });
                streamTrack.stop(); // This kills the camera hardware
                video.style.display = "none"; // Hide the black video box
                addLog("Camera Off - Processing");
            } catch (e) { }
        }

        Tesseract.recognize(canvas, 'eng').then(({ data: { text } }) => {
            const priceRegex = /\d+[.,]\d{2}/g;
            const matches = text.match(priceRegex);

            if (matches) {
                const total = Math.max(...matches.map(m => parseFloat(m.replace(',', '.'))));
                document.getElementById('scanned-number').innerText = total;
                convertCurrency(total);
            } else {
                addLog("No Price Found - Reset to try again");
            }
        });
    }, 300);
});

async function convertCurrency(amount) {
    const away = awaySelect.value;
    const home = homeSelect.value;
    try {
        const url = `https://v6.exchangerate-api.com/v6/${API_KEYS.CURRENCY_KEY}/latest/${away}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.result === "success") {
            const rate = data.conversion_rates[home];
            document.getElementById('usd-total').innerText = (amount * rate).toFixed(2);
            document.getElementById('current-rate').innerText = rate.toFixed(2);
            document.getElementById('rate-away').innerText = away;
            document.getElementById('rate-home').innerText = home;
            addLog("Success! Press Reset for next scan.");
        }
    } catch (err) { addLog("API Error"); }
}

document.getElementById('reset-button').addEventListener('click', () => {
    document.getElementById('scanned-number').innerText = "--";
    document.getElementById('usd-total').innerText = "--";
    startCamera(); // Re-start the camera for the next scan
    addLog("System Reset - Camera On");
});

function addLog(msg) {
    document.getElementById('latest-message').innerText = msg;
    const now = new Date().toLocaleTimeString();
    eventLog.unshift(`[${now}] ${msg}`);
    if (eventLog.length > 5) eventLog.pop();
}

function checkCurrencyMatch() {
    const isSame = awaySelect.value === homeSelect.value;
    captureBtn.classList.toggle('disabled-btn', isSame);
}