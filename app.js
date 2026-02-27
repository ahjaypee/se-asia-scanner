const video = document.getElementById('camera-stream');
const captureBtn = document.getElementById('scanner-button');
const torchBtn = document.getElementById('torch-button');
const awaySelect = document.getElementById('away-currency');
const homeSelect = document.getElementById('home-currency');
const scannedInput = document.getElementById('scanned-input');
const modeChips = document.querySelectorAll('.mode-chip');

const currencyPanel = document.getElementById('currency-panel');
const totalsPanel = document.getElementById('totals-panel');
const logContainer = document.getElementById('log-container');

// Reading Modal Elements
const readingModal = document.getElementById('reading-modal');
const readingText = document.getElementById('reading-text');

let streamTrack = null;
let isCameraActive = false;
let isProcessing = false;
let currentScanMode = 'receipt';

let clickCount = 0;
let clickTimer;

window.onload = () => {
    loadSettings();
    startCamera();
    updateWorkspace();
};

function saveSettings() {
    localStorage.setItem('tsp_home', homeSelect.value);
    localStorage.setItem('tsp_away', awaySelect.value);
    localStorage.setItem('tsp_mode', currentScanMode);
}

function loadSettings() {
    if (localStorage.getItem('tsp_home')) homeSelect.value = localStorage.getItem('tsp_home');
    if (localStorage.getItem('tsp_away')) awaySelect.value = localStorage.getItem('tsp_away');
    if (localStorage.getItem('tsp_mode')) currentScanMode = localStorage.getItem('tsp_mode');
    
    modeChips.forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-mode') === currentScanMode);
    });
}

function resetTotals() {
    if (scannedInput) scannedInput.value = "";
    const usdTotalEl = document.getElementById('usd-total');
    if (usdTotalEl) {
        usdTotalEl.innerText = "--";
        usdTotalEl.classList.remove('success-pulse');
    }
}

function updateWorkspace() {
    if (currentScanMode === 'receipt') {
        currencyPanel.classList.remove('hidden');
        totalsPanel.classList.remove('hidden');
        logContainer.classList.remove('expanded');
    } else {
        currencyPanel.classList.add('hidden');
        totalsPanel.classList.add('hidden');
        logContainer.classList.add('expanded');
    }
    
    const scannedTag = document.getElementById('scanned-currency-tag');
    if (scannedTag) scannedTag.innerText = awaySelect.value;
    
    const homeTag = document.getElementById('home-currency-tag');
    if (homeTag) homeTag.innerText = homeSelect.value;
    
    resetTotals();
}

modeChips.forEach(chip => {
    chip.addEventListener('click', () => {
        clickCount++;
        
        modeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentScanMode = chip.getAttribute('data-mode');
        saveSettings();
        updateWorkspace();
        
        clearTimeout(clickTimer);
        
        clickTimer = setTimeout(() => {
            clickCount = 0; 
            addLog(`Mode switched to: ${currentScanMode.toUpperCase()}`);
            if (!isCameraActive && !isProcessing) wakeCamera();
        }, 500);

        if (clickCount === 3) {
            clickCount = 0; 
            clearTimeout(clickTimer); 
            triggerHelp(currentScanMode);
        }
    });
});

function triggerHelp(mode) {
    let helpMsg = "";
    if (mode === "receipt") helpMsg = "Goal: Audit expenses. Ensure the receipt is flat and well-lit. Tap SCAN to calculate totals in your Home currency.";
    if (mode === "menu") helpMsg = "Goal: Translate and find specialties. Fill the screen with the