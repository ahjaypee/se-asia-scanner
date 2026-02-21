const captureBtn = document.getElementById('scanner-button');
const video = document.getElementById('camera-stream');


// This part turns the camera ON as soon as the page loads
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, // Uses the back camera
            audio: false 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Camera error: ", err);
        alert("Camera blocked. Please allow camera access in your browser settings.");
    }
}
captureBtn.addEventListener('click', () => {
    alert("Shutter Fired!");
});

// Move this to the very last line
startCamera();