const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('capture-btn');
const canvas = document.getElementById('snapshot');
/ 2. Add the "Listen for Click" event
captureBtn.addEventListener('click', async () => {
    console.log("Button clicked!");
    processBill(); // This tells the app to start the scan
});
// 1. Initialize Camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
    } catch (err) {
        console.error("Camera access denied", err);
    }
}

// 2. Capture and OCR
captureBtn.addEventListener('click', async () => {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    // Run Tesseract OCR
    const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
    processBill(text);
	checkTouristTrap(text, currentCountry);
});

function processBill(text) {
    // Basic regex to find numbers/totals (Simplified for demo)
    const numbers = text.match(/\d+[,.]\d+/g);
    if (numbers) {
        const total = Math.max(...numbers.map(n => parseFloat(n.replace(',', ''))));
        document.getElementById('local-total').innerText = total;
        convertCurrency(total);
    }
}

async function convertCurrency(amount) {
    // Replace with your API key
    const res = await fetch(`https://v6.exchangerate-api.com/v6/b5af70e98175c3764fda6084/latest/THB`);
    const data = await res.json();
    const rate = data.conversion_rates.USD;
    document.getElementById('usd-total').innerText = `$${(amount * rate).toFixed(2)}`;
}

startCamera();
// Configuration for SE Asia rules
const regionalConfig = {
    "Thailand": { currency: "THB", symbol: "฿", tip: "Round up or 20-50 THB. 10% if no service charge." },
    "Vietnam": { currency: "VND", symbol: "₫", tip: "Not expected, but 10% is kind in tourist areas." },
    "Singapore": { currency: "SGD", symbol: "S$", tip: "No tipping. 10% service charge is already included." }
};

let currentCountry = "Thailand"; // Default

function updateLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Using a free Reverse Geocoding API to get the country name
            const geoRes = await fetch(`https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}`);
            const geoData = await geoRes.json();
            const country = geoData.address.country;

            if (regionalConfig[country]) {
                currentCountry = country;
                document.getElementById('tip-advice').innerText = regionalConfig[country].tip;
                console.log(`Setting app to ${country} mode.`);
            }
        });
    }
}

// Call this when the app starts
updateLocation();

async function checkTouristTrap(billText, country) {
    const prompt = `I am a tourist in ${country}. Here is the text from my restaurant bill: "${billText}". 
    Based on local 2026 prices, is this a fair price or a tourist trap? Give me a 1-sentence verdict and a 'Tourist Trap Score' out of 10.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyAZ3XwcoNY6CxqY0gARn-YmFZPIj9a5084`, {
            method: 'POST',
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const verdict = data.candidates[0].content.parts[0].text;
        
        document.getElementById('tip-advice').innerHTML += `<br><br><strong>AI Verdict:</strong> ${verdict}`;
    } catch (err) {
        console.error("AI check failed", err);
    }
}