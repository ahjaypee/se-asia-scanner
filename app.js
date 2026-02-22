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
        console.log("Raw Text:", text);
        
        // 1. Remove commas used as thousands separators (e.g., 1,200.00 -> 1200.00)
        // This is common in Thailand and Singapore
        let cleanedText = text.replace(/,(?=\d{3})/g, '');
        
        // 2. Find anything that looks like a decimal number
        const priceRegex = /\d+\.\d{2}/g; 
        const prices = cleanedText.match(priceRegex);

        if (prices) {
            // 3. Convert to numbers and find the max
            const numericPrices = prices.map(p => parseFloat(p));
            const total = Math.max(...numericPrices);
            
            document.getElementById('tip-advice').innerText = `Found Total: ${total}`;
            convertCurrency(total);
        } else {
            // If no decimals found, look for whole numbers as a backup
           Tesseract.recognize(canvas, 'eng').then(({ data: { text } }) => {
        console.log("Raw Text:", text);
        
        // 1. Remove commas used as thousands separators (e.g., 1,200.00 -> 1200.00)
        // This is common in Thailand and Singapore
        let cleanedText = text.replace(/,(?=\d{3})/g, '');
        
        // 2. Find anything that looks like a decimal number
        const priceRegex = /\d+\.\d{2}/g; 
        const prices = cleanedText.match(priceRegex);

        if (prices) {
            // 3. Convert to numbers and find the max
            const numericPrices = prices.map(p => parseFloat(p));
            const total = Math.max(...numericPrices);
            
            document.getElementById('tip-advice').innerText = `Found Total: ${total}`;
            convertCurrency(total);
        } else {
            // If no decimals found, look for whole numbers as a backup
            document.getElementById('tip-advice').innerText = "Saw: " + text.substring(0, 30)
            console.log("No prices found in: " + text);
        }
    });
            console.log("No prices found in: " + text);
        }
    });
});

// Move this to the very last line
// Wait 1 second for the page to settle before turning on the lens
setTimeout(startCamera, 1000);

async function convertCurrency(amount) {
    const apiKey = CONFIG.API_KEY;
    
    // This line grabs the currency code (THB, VND, or SGD) from your dropdown
    const countryCurrency = document.getElementById('country-selector').value; 
    
    try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${countryCurrency}`);
        const data = await response.json();
        
        if (data.result === "success") {
            const rate = data.conversion_rates.USD;
            const usdAmount = (amount * rate).toFixed(2);
            
            document.getElementById('usd-total').innerText = `$${usdAmount}`;
            document.getElementById('tip-advice').innerText = `Rate: 1 ${countryCurrency} = $${rate.toFixed(6)}`;
        }
    } catch (err) {
        console.error("API Error:", err);
    }
}