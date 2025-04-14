// --- Configuration ---
const BACKEND_URL = 'https://pos365-tool-api.onrender.com';

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const shopNameInput = document.getElementById('shop-name');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const branchSelect = document.getElementById('branch-select');
const branchStatus = document.getElementById('branch-status');
const actionButtonsContainer = document.getElementById('action-buttons');
const actionButtons = document.querySelectorAll('.action-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const currentActionSpan = document.getElementById('current-action');
const logOutput = document.getElementById('log-output');

// --- State Variables ---
let currentSessionId = null;
let currentShopName = null;
let selectedBranchId = null;
let isProcessing = false;
let eventSource = null;
const SSE_TIMEOUT = 300000; // 5 phút timeout cho SSE

// --- Utility Functions ---
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${timestamp}] ${message}`;
    logEntry.className = `log-${type}`;
    logOutput.appendChild(logEntry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

function setLoading(loading, isAction = false) {
    if (isAction) {
        isProcessing = loading;
    }
    loginBtn.disabled = loading;
    actionButtons.forEach(btn => { btn.disabled = loading; }); // Dòng ~44, viết rõ ràng hơn
    branchSelect.disabled = loading;
    if (loading) {
        log(isAction ? 'Đang xử lý hành động, vui lòng đợi...' : 'Đang thực hiện thao tác...', 'info');
    }
}

function resetProgress() {
    progressSection.style.display = 'none';
    progressBar.value = 0;
    progressText.textContent = '0%';
    currentActionSpan.textContent = '';
}

function updateProgress(processed, total, message = '') {
    if (total > 0) {
        const percentage = Math.round((processed / total) * 100);
        progressBar.value = percentage;
        progressText.textContent = `${percentage}%`;
    } else {
        progressBar.value = 0;
        progressText.textContent = '0%';
    }
    currentActionSpan.textContent = message || `Đã xử lý ${processed}/${total}`;
    progressSection.style.display = 'block';
}

function updateBranchStatus(message, isError = false) {
    branchStatus.textContent = message;
    branchStatus.className = `status-message ${isError ? 'error' : ''}`;
}

function closeEventSource() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
        log('Đã đóng kết nối SSE.', 'info');
    }
}

// --- Event Handlers ---

// Login
loginBtn.addEventListener('click', async () => {
    currentShopName = shopNameInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!currentShopName || !username || !password) {
        log('Vui lòng nhập đầy đủ thông tin đăng nhập.', 'error');
        return;
    }

    setLoading(true);
    log(`Đang đăng nhập vào shop: ${currentShopName}...`);

    try {
        const response = await fetch(`${BACKEND_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json
