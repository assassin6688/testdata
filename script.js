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
const STREAM_TIMEOUT = 300000; // 5 phút timeout cho stream

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
    actionButtons.forEach(btn => { btn.disabled = loading; });
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_name: currentShopName, username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            currentSessionId = data.session_id;
            log(data.message, 'success');

            // Populate branch dropdown
            branchSelect.innerHTML = '<option value="">-- Vui lòng chọn --</option>';
            if (data.branches && data.branches.length > 0) {
                data.branches.forEach(branch => {
                    if (branch.Id && branch.Name) {
                        const option = document.createElement('option');
                        option.value = branch.Id;
                        option.textContent = branch.Name;
                        branchSelect.appendChild(option);
                    } else {
                        log(`Chi nhánh không hợp lệ: ${JSON.stringify(branch)}`, 'error');
                    }
                });
                branchSelect.disabled = false;
                updateBranchStatus('Vui lòng chọn chi nhánh.');
                log(`Tìm thấy ${data.branches.length} chi nhánh.`);
            } else {
                branchSelect.disabled = true;
                updateBranchStatus('Không tìm thấy chi nhánh nào. Vui lòng kiểm tra thông tin đăng nhập hoặc liên hệ hỗ trợ.', true);
                log('Không có chi nhánh nào được trả về từ server.', 'error');
            }

            loginSection.style.display = 'none';
            mainSection.style.display = 'block';
            resetProgress();
        } else {
            log(`Đăng nhập thất bại: ${data.message || response.statusText}`, 'error');
            currentSessionId = null;
            currentShopName = null;
        }
    } catch (error) {
        log(`Lỗi kết nối hoặc xử lý: ${error.message}`, 'error');
        currentSessionId = null;
        currentShopName = null;
    } finally {
        setLoading(false);
    }
});

// Select Branch
branchSelect.addEventListener('change', async () => {
    selectedBranchId = branchSelect.value;
    updateBranchStatus('');

    if (!selectedBranchId) {
        log('Chưa chọn chi nhánh.', 'info');
        actionButtons.forEach(btn => { btn.disabled = btn.dataset.branchFilter === 'true'; });
        return;
    }

    if (!currentSessionId || !currentShopName) {
        log('Lỗi: Thiếu Session ID hoặc Shop Name để chọn chi nhánh.', 'error');
        branchSelect.value = '';
        selectedBranchId = null;
        return;
    }

    setLoading(true);
    updateBranchStatus(`Đang chọn chi nhánh: ${branchSelect.options[branchSelect.selectedIndex].text}...`);
    log(`Đang chọn chi nhánh ID: ${selectedBranchId}`);

    try {
        const response = await fetch(`${BACKEND_URL}/api/select_branch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shop_name: currentShopName,
                session_id: currentSessionId,
                branch_id: selectedBranchId
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            log(data.message, 'success');
            updateBranchStatus(`Đã chọn: ${branchSelect.options[branchSelect.selectedIndex].text}`);
            actionButtons.forEach(btn => { btn.disabled = false; });
        } else {
            log(`Chọn chi nhánh thất bại: ${data.message || response.statusText}`, 'error');
            updateBranchStatus(`Lỗi chọn chi nhánh: ${data.message || response.statusText}`, true);
            selectedBranchId@_script.js:323 null;
            branchSelect.value = '';
            actionButtons.forEach(btn => { btn.disabled = btn.dataset.branchFilter === 'true'; });
        }
    } catch (error) {
        log(`Lỗi kết nối khi chọn chi nhánh: ${error.message}`, 'error');
        updateBranchStatus(`Lỗi kết nối khi chọn chi nhánh.`, true);
        selectedBranchId = null;
        branchSelect.value = '';
        actionButtons.forEach(btn => { btn.dataset.branchFilter === 'true'; });
    } finally {
        setLoading(false);
    }
});

// Action Buttons
actionButtons.forEach(button => {
    button.addEventListener('click
