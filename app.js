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
    // Add this safety check at the very top of the function
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
            const usdAmount = (amount * rate).toFixed(2);
            document.getElementById('usd-total').innerText = `$${usdAmount}`;
        } else {
            document.getElementById('usd-total').innerText = "Invalid Key";
        }
   } catch (err) {
        // This will display the actual error message on your phone screen
        document.getElementById('usd-total').innerText = "Err: " + err.message.substring(0, 10);
    }
}

// This ensures the page is fully loaded before we turn the camera on
window.onload = () => {
    startCamera();
};