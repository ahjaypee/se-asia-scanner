// Start the camera immediately
startCamera();

const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('capture-btn');

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
