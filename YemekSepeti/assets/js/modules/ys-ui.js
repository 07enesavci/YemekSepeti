/**
 * YS-UI: Yükleme animasyonları, Toast bildirimleri,
 *         Oturum zaman aşımı uyarısı, Form validasyonu
 */
(function (window) {
    'use strict';

    // ─── LOADING OVERLAY ──────────────────────────────────────────
    let _loadingCount = 0;
    let _loadingEl = null;

    function _getLoadingEl() {
        if (!_loadingEl) {
            _loadingEl = document.getElementById('ys-loading-overlay');
        }
        return _loadingEl;
    }

    function showLoading(text) {
        _loadingCount++;
        const el = _getLoadingEl();
        if (!el) return;
        const textEl = el.querySelector('.ys-loading-text');
        if (textEl) textEl.textContent = text || 'Yükleniyor...';
        el.classList.add('active');
    }

    function hideLoading() {
        _loadingCount = Math.max(0, _loadingCount - 1);
        if (_loadingCount > 0) return;
        const el = _getLoadingEl();
        if (el) el.classList.remove('active');
    }

    function withLoading(promise, text) {
        showLoading(text);
        return Promise.resolve(promise).finally(hideLoading);
    }

    // ─── TOAST BİLDİRİMLERİ ───────────────────────────────────────
    let _toastContainer = null;
    const TOAST_ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    function _getToastContainer() {
        if (!_toastContainer) {
            _toastContainer = document.getElementById('ys-toast-container');
            if (!_toastContainer) {
                _toastContainer = document.createElement('div');
                _toastContainer.id = 'ys-toast-container';
                document.body.appendChild(_toastContainer);
            }
        }
        return _toastContainer;
    }

    function showToast(message, type, duration) {
        type = type || 'info';
        duration = duration || 3500;
        const container = _getToastContainer();
        const toast = document.createElement('div');
        toast.className = `ys-toast ${type}`;
        toast.innerHTML = `<span class="ys-toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('hiding');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 320);
        }, duration);
    }

    // ─── OTURUM ZAMAN AŞIMI UYARISI ───────────────────────────────
    const SESSION_WARNING_BEFORE_MS = 5 * 60 * 1000;  // son 5 dk'da uyar
    const SESSION_CHECK_INTERVAL_MS = 30 * 1000;       // 30 sn'de bir kontrol
    let _sessionCheckTimer = null;
    let _sessionCountdownTimer = null;
    let _sessionWarningVisible = false;
    let _sessionExpireAt = null;

    function _initSessionTimeout() {
        // Oturum bilgisi varsa başlat
        const userEl = document.body;
        const userId = window.__userId || '';
        if (!userId) return;

        // Sunucudan oturum süresini al
        _fetchSessionExpiry();
        _sessionCheckTimer = setInterval(_checkSession, SESSION_CHECK_INTERVAL_MS);
    }

    async function _fetchSessionExpiry() {
        try {
            const apiBase = window.getApiBaseUrl ? window.getApiBaseUrl() : '';
            const res = await fetch(`${apiBase}/api/auth/session-info`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data.expiresAt) {
                    _sessionExpireAt = new Date(data.expiresAt).getTime();
                }
            }
        } catch (_) {}
    }

    function _checkSession() {
        if (!_sessionExpireAt) return;
        const now = Date.now();
        const remaining = _sessionExpireAt - now;

        if (remaining <= 0) {
            _hideSessionWarning();
            _autoLogout();
            return;
        }

        if (remaining <= SESSION_WARNING_BEFORE_MS && !_sessionWarningVisible) {
            _showSessionWarning(remaining);
        } else if (remaining > SESSION_WARNING_BEFORE_MS && _sessionWarningVisible) {
            _hideSessionWarning();
        }

        if (_sessionWarningVisible) {
            _updateCountdown(remaining);
        }
    }

    function _showSessionWarning(remainingMs) {
        _sessionWarningVisible = true;
        const backdrop = document.getElementById('ys-session-warning-backdrop');
        const modal = document.getElementById('ys-session-warning');
        if (backdrop) backdrop.classList.add('visible');
        if (modal) modal.classList.add('visible');
        _updateCountdown(remainingMs);
    }

    function _hideSessionWarning() {
        _sessionWarningVisible = false;
        const backdrop = document.getElementById('ys-session-warning-backdrop');
        const modal = document.getElementById('ys-session-warning');
        if (backdrop) backdrop.classList.remove('visible');
        if (modal) modal.classList.remove('visible');
    }

    function _updateCountdown(remainingMs) {
        const secs = Math.max(0, Math.ceil(remainingMs / 1000));
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        const countdownEl = document.getElementById('ys-session-countdown');
        if (countdownEl) {
            countdownEl.textContent = `${String(mins).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }
    }

    async function _extendSession() {
        try {
            const apiBase = window.getApiBaseUrl ? window.getApiBaseUrl() : '';
            const res = await fetch(`${apiBase}/api/auth/extend-session`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.getCsrfToken ? window.getCsrfToken() : '' }
            });
            if (res.ok) {
                await _fetchSessionExpiry();
                _hideSessionWarning();
                showToast('Oturum uzatıldı.', 'success');
            }
        } catch (_) {}
    }

    function _autoLogout() {
        showToast('Oturum süreniz doldu. Yeniden giriş yapınız.', 'warning', 4000);
        setTimeout(function () {
            window.location.href = '/login';
        }, 1500);
    }

    // ─── FORM DOĞRULAMA ───────────────────────────────────────────
    function validateEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
    }

    function validatePassword(value) {
        const s = String(value);
        if (s.length < 8) return { ok: false, msg: 'En az 8 karakter gerekli.' };
        if (!/[A-Z]/.test(s)) return { ok: false, msg: 'En az bir büyük harf ekleyin.' };
        if (!/[0-9]/.test(s)) return { ok: false, msg: 'En az bir rakam ekleyin.' };
        return { ok: true, msg: '' };
    }

    function getPasswordStrength(value) {
        const s = String(value);
        if (s.length < 6) return 'weak';
        let score = 0;
        if (s.length >= 8) score++;
        if (s.length >= 12) score++;
        if (/[A-Z]/.test(s)) score++;
        if (/[0-9]/.test(s)) score++;
        if (/[^A-Za-z0-9]/.test(s)) score++;
        if (score <= 2) return 'weak';
        if (score <= 3) return 'medium';
        return 'strong';
    }

    function applyInputValidation(inputEl, isValid, msg) {
        if (!inputEl) return;
        inputEl.classList.remove('is-valid', 'is-invalid', 'ys-input-valid', 'ys-input-invalid');
        let feedbackEl = inputEl.parentNode && inputEl.parentNode.querySelector('.form-feedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.className = 'form-feedback';
            if (inputEl.parentNode) inputEl.parentNode.appendChild(feedbackEl);
        }
        if (isValid) {
            inputEl.classList.add('is-valid');
            feedbackEl.className = 'form-feedback valid';
            feedbackEl.textContent = '✓ Geçerli';
        } else {
            inputEl.classList.add('is-invalid');
            feedbackEl.className = 'form-feedback invalid';
            feedbackEl.textContent = msg || 'Geçersiz';
        }
    }

    function addPasswordStrengthIndicator(inputEl) {
        if (!inputEl || inputEl.dataset.strengthAdded) return;
        inputEl.dataset.strengthAdded = '1';

        const bar = document.createElement('div');
        bar.className = 'password-strength-bar';
        const label = document.createElement('div');
        label.className = 'password-strength-label';

        if (inputEl.parentNode) {
            inputEl.parentNode.insertBefore(bar, inputEl.nextSibling);
            inputEl.parentNode.insertBefore(label, bar.nextSibling);
        }

        inputEl.addEventListener('input', function () {
            const strength = getPasswordStrength(this.value);
            bar.className = `password-strength-bar ${strength}`;
            const labels = { weak: 'Zayıf şifre', medium: 'Orta güçlü şifre', strong: 'Güçlü şifre ✓' };
            label.className = `password-strength-label ${strength}`;
            label.textContent = this.value ? labels[strength] : '';
        });
    }

    // CSRF token yönetimi
    let _csrfToken = '';
    async function _loadCsrfToken() {
        try {
            const apiBase = window.getApiBaseUrl ? window.getApiBaseUrl() : '';
            const res = await fetch(`${apiBase}/api/csrf-token`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                _csrfToken = data.token || '';
            }
        } catch (_) {}
    }
    function getCsrfToken() { return _csrfToken; }

    // ─── BAŞLATMA ─────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        _loadCsrfToken();
        if (window.__userId) {
            _initSessionTimeout();
        }

        // Oturum uyarı butonları
        const extendBtn = document.getElementById('ys-session-extend-btn');
        const logoutBtn2 = document.getElementById('ys-session-logout-btn');
        if (extendBtn) extendBtn.addEventListener('click', _extendSession);
        if (logoutBtn2) logoutBtn2.addEventListener('click', function () {
            _hideSessionWarning();
            if (window.logout) window.logout();
            else window.location.href = '/login';
        });
    });

    // ─── PUBLIC API ───────────────────────────────────────────────
    window.YsUI = {
        showLoading,
        hideLoading,
        withLoading,
        showToast,
        validateEmail,
        validatePassword,
        getPasswordStrength,
        applyInputValidation,
        addPasswordStrengthIndicator,
        getCsrfToken
    };

    // Geriye dönük uyumluluk için kısayollar
    window.getCsrfToken = getCsrfToken;

})(window);
