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
    // 1. Log the raw text so you can see it in the 'tip-advice' box for debugging
    console.log("Raw Scan:", text);
    
    // 2. Clean the text: remove common OCR errors (like turning '5' into 'S')
    let cleanedText = text.replace(/S/g, '5').replace(/I/g, '1').replace(/O/g, '0');

    // 3. New Regex: Look for numbers with 2 decimal places (e.g. 10.50) 
    // or large numbers without decimals (common for Vietnam)
    const priceRegex = /\d+[\.,]\d{2}|\d{4,}/g; 
    const matches = cleanedText.match(priceRegex);

    if (matches) {
        // Convert matches to clean numbers
        const numericPrices = matches.map(m => {
            return parseFloat(m.replace(',', '.')); 
        });

        // Pick the highest number (usually the total)
        const total = Math.max(...numericPrices);
        
        document.getElementById('tip-advice').innerText = `Scanned Total: ${total}`;
        convertCurrency(total);
    } else {
        // If we can't find a price, show the first bit of text so we know what it DID see
        document.getElementById('tip-advice').innerText = "Unclear scan. Saw: " + text.substring(0, 15);
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