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
    
    // Create a virtual canvas to capture the frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.width > 0 ? canvas.getContext('2d') : null;

    if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Use Tesseract to read the "photo"
        Tesseract.recognize(canvas, 'eng').then(({ data: { text } }) => {
            console.log("Read text:", text);
            
            // Look for prices (numbers with decimals)
            const priceRegex = /\d+[.,]\d{2}/g;
            const matches = text.match(priceRegex);

            if (matches) {
                const total = Math.max(...matches.map(m => parseFloat(m.replace(',', '.'))));
                localDisplay.innerText = `Found: ${total}`;
                convertCurrency(total);
            } else {
                localDisplay.innerText = "Price not found. Try again!";
            }
        });
    }
});

// 3. The Currency Logic
async function convertCurrency(amount) {
    // 1. Safety check for the API key
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
            const usdAmount = parseFloat((amount * rate).toFixed(2)); // We need this as a number for comparison
            
            // Update the main USD display
            document.getElementById('usd-total').innerText = `$${usdAmount}`;

            // --- START RIP-OFF LOGIC ---
            const tipElement = document.getElementById('tip-advice');
            let verdict = "";
            let verdictColor = "#4ade80"; // Default to Green (Good)

            if (currency === "VND" && usdAmount > 15) {
                verdict = "⚠️ High for Vietnam!";
                verdictColor = "#f87171"; // Red
            } else if (currency === "SGD" && usdAmount > 25) {
                verdict = "⚠️ Steep for Singapore!";
                verdictColor = "#f87171"; // Red
            } else if (currency === "THB" && usdAmount > 20) {
                verdict = "⚠️ Tourist price alert!";
                verdictColor = "#fbbf24"; // Yellow/Amber
            } else {
                verdict = "✅ Looks like a fair deal.";
                verdictColor = "#4ade80"; // Green
            }

            tipElement.innerText = verdict;
            tipElement.style.color = verdictColor;
            // --- END RIP-OFF LOGIC ---

        } else {
            document.getElementById('usd-total').innerText = "Invalid Key";
        }
    } catch (err) {
        document.getElementById('usd-total').innerText = "Err: " + err.message.substring(0, 10);
    }
}

// This ensures the page is fully loaded before we turn the camera on
window.onload = () => {
    startCamera();
};
// Reset Button Logic
document.getElementById('reset-button').addEventListener('click', () => {
    document.getElementById('tip-advice').innerText = "--";
    document.getElementById('usd-total').innerText = "--";
});