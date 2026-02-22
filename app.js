const captureBtn = document.getElementById('scanner-button');
const video = document.getElementById('camera-stream');


// This part turns the camera ON as soon as the page loads
async function startCamera() {
    const constraints = {
        video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        // This line forces the video to play if it's stuck
        video.onloadedmetadata = () => {
            video.play();
        };
    } catch (err) {
        console.error("Camera error:", err);
        alert("Camera issue: " + err.name);
    }
}
captureBtn.addEventListener('click', async () => {
    // 1. Create a "virtual" canvas to hold the photo
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // 2. Draw the current camera frame onto the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 3. Show a loading message
    document.getElementById('tip-advice').innerText = "OCR Scanning in progress...";

    // 4. Send the photo to Tesseract (the OCR brain)
    Tesseract.recognize(canvas, 'eng').then(({ data: { text } }) => {
        console.log("Found text:", text);
        
        // 1. Find numbers that look like prices (e.g., 100.00 or 50,00)
        const priceRegex = /\d+[.,]\d{2}/g;
        const prices = text.match(priceRegex);

        if (prices) {
            // 2. Convert them to actual numbers and find the highest one (the Total)
            const numericPrices = prices.map(p => parseFloat(p.replace(',', '')));
            const total = Math.max(...numericPrices);
            
            // 3. Display the local total
            document.getElementById('tip-advice').innerText = `Scanned Total: ${total}`;
            
            // 4. Run the conversion (We'll add this function next)
            convertCurrency(total);
        } else {
            document.getElementById('tip-advice').innerText = "Total not found. Try a clearer photo!";
        }
    });
});

// Move this to the very last line
// Wait 1 second for the page to settle before turning on the lens
setTimeout(startCamera, 1000);

async function convertCurrency(amount) {
    const apiKey = 'b5af70e98175c3764fda6084'; // Use your real key from config.js
    const countryCurrency = "THB"; // We'll start with Thailand as a test
    
    try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${countryCurrency}`);
        const data = await response.json();
        const rate = data.conversion_rates.USD;
        const usdAmount = (amount * rate).toFixed(2);
        
        document.getElementById('usd-total').innerText = `$${usdAmount}`;
        document.getElementById('tip-advice').innerText = `Success! ${amount} ${countryCurrency} is $${usdAmount} USD.`;
    } catch (err) {
        document.getElementById('usd-total').innerText = "Error";
        console.error(err);
    }
}