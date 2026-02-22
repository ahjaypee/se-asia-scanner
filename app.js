const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');

async function startCamera() {
    try {
        // We are asking for the bare minimum here to force it to open
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, 
            audio: false 
        });
        video.srcObject = stream;
    } catch (err) {
        alert("Camera Error: " + err.name);
    }
}

// Set up the button to alert us so we know the script is alive
captureBtn.addEventListener('click', () => {
    alert("Button pressed - logic is working!");
});

// Start the camera
startCamera();