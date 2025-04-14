// --- Configuration ---
// !!! QUAN TRỌNG: Thay đổi URL này thành URL backend của bạn sau khi deploy lên Render !!!
const BACKEND_URL = 'https://pos365-tool-api.onrender.com'; // URL backend Flask (khi chạy local)
// Ví dụ khi deploy: const BACKEND_URL = 'https://your-flask-app-name.onrender.com';

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
let isProcessing = false; // Cờ để ngăn chặn nhiều hành động cùng lúc
let eventSource = null; // Để giữ kết nối SSE

// --- Utility Functions ---
function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${timestamp}] ${message}`;
    if (type === 'error') {
        logEntry.classList.add('log-error');
    } else if (type === 'success') {
        logEntry.classList.add('log-success');
    } else {
         logEntry.classList.add('log-info');
    }
    logOutput.appendChild(logEntry);
    logOutput.scrollTop = logOutput.scrollHeight; // Cuộn xuống dưới cùng
}

function setLoading(loading) {
    isProcessing = loading;
    loginBtn.disabled = loading;
    actionButtons.forEach(btn => btn.disabled = loading);
    // Có thể thêm hiệu ứng loading trực quan hơn
    if (loading) {
        log('Đang xử lý, vui lòng đợi...');
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
         progressText.textContent = `0%`;
    }
     currentActionSpan.textContent = message || `Đã xử lý ${processed}/${total}`;
     progressSection.style.display = 'block';
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
            log(`Session ID: ${currentSessionId}`); // Chỉ log để debug, có thể xóa sau

            // Populate branch dropdown
            branchSelect.innerHTML = '<option value="">-- Vui lòng chọn --</option>'; // Clear old options
            if (data.branches && data.branches.length > 0) {
                data.branches.forEach(branch => {
                    const option = document.createElement('option');
                    option.value = branch.Id;
                    option.textContent = branch.Name;
                    branchSelect.appendChild(option);
                });
            } else {
                 log('Không tìm thấy chi nhánh nào hoặc có lỗi khi lấy danh sách chi nhánh.', 'info');
            }


            loginSection.style.display = 'none';
            mainSection.style.display = 'block';
            resetProgress(); // Ẩn progress bar cũ nếu có
        } else {
            log(`Đăng nhập thất bại: ${data.message || response.statusText}`, 'error');
            currentSessionId = null;
            currentShopName = null;
        }
    } catch (error) {
        log(`Lỗi kết nối hoặc xử lý: ${error}`, 'error');
        currentSessionId = null;
        currentShopName = null;
    } finally {
        setLoading(false);
    }
});

// Select Branch
branchSelect.addEventListener('change', async () => {
    selectedBranchId = branchSelect.value;
    branchStatus.textContent = ''; // Clear previous status

    if (!selectedBranchId) {
        log('Chưa chọn chi nhánh.', 'info');
        // Disable các nút cần chi nhánh
        actionButtons.forEach(btn => {
             if (btn.dataset.branchFilter === 'true') {
                 btn.disabled = true;
             }
        });
        return;
    }

    if (!currentSessionId || !currentShopName) {
         log('Lỗi: Thiếu Session ID hoặc Shop Name để chọn chi nhánh.', 'error');
         return;
    }

    setLoading(true); // Có thể không cần disable nút khác ở đây
    branchStatus.textContent = `Đang chọn chi nhánh: ${branchSelect.options[branchSelect.selectedIndex].text}...`;
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
            branchStatus.textContent = `Đã chọn: ${branchSelect.options[branchSelect.selectedIndex].text}`;
             // Enable các nút cần chi nhánh
             actionButtons.forEach(btn => {
                 // Enable tất cả nút nếu đăng nhập thành công
                 // Nút cần chi nhánh sẽ được kiểm tra lại trước khi chạy action
                 btn.disabled = false;
             });
        } else {
            log(`Chọn chi nhánh thất bại: ${data.message || response.statusText}`, 'error');
            branchStatus.textContent = `Lỗi chọn chi nhánh!`;
            selectedBranchId = null; // Reset nếu lỗi
            branchSelect.value = ""; // Reset dropdown
             // Disable các nút cần chi nhánh
             actionButtons.forEach(btn => {
                 if (btn.dataset.branchFilter === 'true') {
                     btn.disabled = true;
                 }
             });
        }
    } catch (error) {
        log(`Lỗi kết nối khi chọn chi nhánh: ${error}`, 'error');
        branchStatus.textContent = `Lỗi kết nối!`;
        selectedBranchId = null;
        branchSelect.value = "";
         // Disable các nút cần chi nhánh
         actionButtons.forEach(btn => {
             if (btn.dataset.branchFilter === 'true') {
                 btn.disabled = true;
             }
         });
    } finally {
         // Chỉ tắt loading nếu không có hành động chính đang chạy
         if (!isProcessing) {
             setLoading(false);
         }
    }
});

// Action Buttons (Delete/Cancel)
actionButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (isProcessing) {
            log('Đang có một tiến trình khác chạy, vui lòng đợi.', 'error');
            return;
        }

        const endpoint = button.dataset.endpoint;
        const action = button.dataset.action;
        const branchFilter = button.dataset.branchFilter === 'true';
        const extraParam = button.dataset.extraParam || '';
        const buttonLabel = button.textContent;

        if (!currentSessionId || !currentShopName) {
            log('Lỗi: Chưa đăng nhập hoặc Session ID không hợp lệ.', 'error');
            return;
        }

        // Kiểm tra nếu cần chi nhánh mà chưa chọn
        if (branchFilter && !selectedBranchId) {
            log(`Vui lòng chọn một chi nhánh để thực hiện hành động: ${buttonLabel}`, 'error');
            return;
        }

        const confirmation = confirm(`Bạn có chắc chắn muốn "${buttonLabel}" không? Hành động này KHÔNG THỂ hoàn tác!`);
        if (!confirmation) {
            log('Hành động đã được hủy bởi người dùng.', 'info');
            return;
        }

        setLoading(true);
        resetProgress(); // Reset thanh tiến trình trước khi bắt đầu
        log(`Bắt đầu ${buttonLabel}...`);
        progressSection.style.display = 'block'; // Hiển thị khu vực tiến trình
        currentActionSpan.textContent = `Đang chuẩn bị ${buttonLabel}...`;


        // --- Sử dụng Server-Sent Events (SSE) ---
        const params = new URLSearchParams({
            shop_name: currentShopName,
            session_id: currentSessionId,
            endpoint: endpoint,
            branch_filter: branchFilter,
            extra_param: extraParam,
            action: action
        });
        // Chỉ thêm branch_id nếu nó có giá trị (đã được chọn)
        if (selectedBranchId) {
             params.append('branch_id', selectedBranchId);
        }

        const url = `${BACKEND_URL}/api/process_data?${params.toString()}`;
        eventSource = new EventSource(url); // Mở kết nối SSE

        eventSource.onopen = function() {
             log(`Đã kết nối tới server để ${buttonLabel}.`);
        };

        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'info':
                        log(data.message, 'info');
                        break;
                    case 'error':
                        log(data.message, 'error');
                        // Có thể dừng sớm nếu gặp lỗi nghiêm trọng?
                        // eventSource.close();
                        // setLoading(false);
                        break;
                    case 'progress':
                         // Nhận tổng số mục để khởi tạo progress bar
                         progressBar.max = data.total || 100; // Đặt max cho progress bar
                         log(`Tổng số mục cần xử lý: ${data.total}`);
                         updateProgress(0, data.total, `Đang xử lý ${buttonLabel}...`);
                         break;
                    case 'log':
                        // Log chi tiết từng mục và cập nhật progress
                        const logType = data.status === 'success' ? 'success' : 'error';
                        log(`[${data.id}] ${data.message}`, logType);
                        updateProgress(data.processed, data.total, `Đang ${buttonLabel}: ${data.processed}/${data.total}`);
                        break;
                    case 'done':
                        log(`Hoàn thành ${buttonLabel}. Đóng kết nối SSE.`, 'success');
                        eventSource.close(); // Đóng kết nối khi server báo xong
                        setLoading(false);
                        // Không ẩn progress ngay, để người dùng xem kết quả
                        // resetProgress();
                        break;
                    default:
                        log(`Nhận dữ liệu không xác định: ${event.data}`, 'info');
                }
            } catch (e) {
                 log(`Lỗi xử lý dữ liệu SSE: ${e}`, 'error');
                 log(`Dữ liệu gốc: ${event.data}`);
            }
        };

        eventSource.onerror = function(error) {
            log('Lỗi kết nối Server-Sent Events. Có thể do server đã đóng hoặc lỗi mạng.', 'error');
            console.error("SSE Error: ", error);
            eventSource.close(); // Đóng kết nối khi có lỗi
            setLoading(false);
            // Giữ lại progress bar để thấy trạng thái cuối cùng trước lỗi
        };

    });
});

// --- Initial Setup ---
log('Sẵn sàng. Vui lòng đăng nhập.');
// Ban đầu disable các nút action và branch select
branchSelect.disabled = true;
actionButtons.forEach(btn => btn.disabled = true);
// Sau khi đăng nhập thành công, branchSelect sẽ được enable
// Các nút action sẽ được enable/disable dựa trên việc chọn chi nhánh (nếu cần)