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
        console.log(text);
        document.getElementById('tip-advice').innerText = "Scan Complete!";
        // This is where we will put the math logic next!
    });
});

// Move this to the very last line
startCamera();