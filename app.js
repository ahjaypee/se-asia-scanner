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
        usd