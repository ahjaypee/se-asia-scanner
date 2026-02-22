const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const localDisplay = document.getElementById('tip-advice');
const usdDisplay = document.getElementById('usd-total');

// 1. Start the Camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, 
            audio: false 
        });
        video.srcObject = stream;
        video.play();
    } catch (err) {
        console.error("Camera Error: ", err);
    }
}

// 2. The Shutter Logic (Taking the photo and reading it)
captureBtn.addEventListener('click', async () => {
    localDisplay.innerText = "Processing Image...";
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.width > 0 ? canvas.getContext('2d') : null;

    if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        Tesseract.recognize(canvas, 'eng').then(({ data: { text } }) => {
            console.log("Read text:", text);
            
            const priceRegex = /\d+[.,]\d{2}/g;
            const matches = text.match(priceRegex);

            if (matches) {
                const total = Math.max(...matches.map(m => parseFloat(m.replace(',', '.'))));
                document.getElementById('scanned-number').innerText = total;
                document.getElementById('tip-advice').innerText = "Calculating USD...";
                convertCurrency(total);
            } else {
                localDisplay.innerText = "Price not found. Try again!";
            }
        });
    }
});

// 3. The Currency Logic
async function convertCurrency(amount) {
    if (typeof API_KEYS === 'undefined') {
        document.getElementById('usd-total').innerText = "Config Loading...";
        return;
    }

    try {
        const apiKey = API_KEYS.CURRENCY_KEY; 
        const currency = document.getElementById('country-selector').value;
        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${currency}`;

        const response = await fetch(url);
        const data = await response.json();
        
        if (data.result === "success") {
            const rate = data.conversion_rates.USD;
            const usdAmount = parseFloat((amount * rate).toFixed(2));
            
            document.getElementById('usd-total').innerText = `$${usdAmount}`;

            const tipElement = document.getElementById('tip-advice');
            let verdict = "";
            let verdictColor = "#4ade80"; 

            if (currency === "VND" && usdAmount > 15) {
                verdict = "⚠️ High for Vietnam!";
                verdictColor = "#f87171"; 
            } else if (currency === "SGD" && usdAmount > 25) {
                verdict = "⚠️ Steep for Singapore!";
                verdictColor = "#f87171"; 
            } else if (currency === "THB" && usdAmount > 20) {
                verdict = "⚠️ Tourist price alert!";
                verdictColor = "#fbbf24"; 
            } else {
                verdict = "✅ Looks like a fair deal.";
                verdictColor = "#4ade80"; 
            }

            tipElement.innerText = verdict;
            tipElement.style.color = verdictColor;

        } else {
            document.getElementById('usd-total').innerText = "Invalid Key";
        }
    } catch (err) {
        document.getElementById('usd-total').innerText = "Err: " + err.message.substring(0, 10);
    }
}

// 4. Reset Button Logic (Clean Version)
document.getElementById('reset-button').addEventListener('click', () => {
    document.getElementById('scanned-number').innerText = "--";
    const tipElement = document.getElementById('tip-advice');
    tipElement.innerText = "Ready to scan...";
    tipElement.style.color = "#94a3b8"; 
    document.getElementById('usd-total').innerText = "--";
});

// 5. Start Up
window.onload = () => {
    startCamera();
};