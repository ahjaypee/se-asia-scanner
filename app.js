// 1. Hook up the screen elements
const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const localDisplay = document.getElementById('tip-advice');
const usdDisplay = document.getElementById('usd-total');

// 2. Simple Camera Start
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

// 3. Simple Button Logic
captureBtn.addEventListener('click', () => {
    localDisplay.innerText = "Scanning...";
    // For testing: If you see this alert, the brain is alive!
    alert("Camera shutter triggered!");
});

// 4. Run!
startCamera();