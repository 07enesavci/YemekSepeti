// Öneri & Şikayet formu — alıcı / satıcı / kurye sayfalarında kullanılır
(function () {
    var STATUS_LABELS = {
        open:      { label: 'Açık',        color: '#92400e', bg: '#fef3c7' },
        in_review: { label: 'İnceleniyor', color: '#1e40af', bg: '#dbeafe' },
        resolved:  { label: 'Çözüldü',     color: '#065f46', bg: '#d1fae5' }
    };
    var TYPE_LABELS = { suggestion: '💡 Öneri', complaint: '⚠️ Şikayet' };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function showMsg(el, text, isError) {
        if (!el) return;
        el.style.display = 'block';
        el.style.backgroundColor = isError ? '#FEE2E2' : '#D1FAE5';
        el.style.color = isError ? '#DC2626' : '#059669';
        el.textContent = text;
    }

    function statusBadge(status) {
        var s = STATUS_LABELS[status] || { label: status, color: '#374151', bg: '#f3f4f6' };
        return '<span style="display:inline-block;padding:0.12rem 0.55rem;border-radius:999px;font-size:0.75rem;font-weight:600;color:' + s.color + ';background:' + s.bg + ';">' + s.label + '</span>';
    }

    function loadMine() {
        var listEl = document.getElementById('feedback-my-list');
        if (!listEl || typeof window.getMyFeedback !== 'function') return;
        window.getMyFeedback().then(function (res) {
            if (!res || !res.success) {
                listEl.innerHTML = '<p style="color:var(--text-color-light);">Talepler yüklenemedi.</p>';
                return;
            }
            var list = res.data || [];
            if (list.length === 0) {
                listEl.innerHTML = '<p style="color:var(--text-color-light);">Henüz bir talebiniz yok.</p>';
                return;
            }
            var html = '';
            list.forEach(function (f) {
                var dateTxt = f.createdAt ? new Date(f.createdAt).toLocaleString('tr-TR') : '';
                html += '<div style="border:1px solid var(--border-color);border-radius:10px;padding:0.75rem 0.9rem;margin-bottom:0.6rem;background:var(--card-bg);">'
                    + '<div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;align-items:center;">'
                    + '<strong>' + (TYPE_LABELS[f.type] || '') + ' — ' + esc(f.subject) + '</strong>'
                    + statusBadge(f.status)
                    + '</div>'
                    + '<div style="color:var(--text-color-light);font-size:0.85rem;margin-top:0.3rem;">' + esc(f.message) + '</div>'
                    + (f.adminNote ? '<div style="margin-top:0.5rem;padding:0.5rem 0.7rem;border-left:3px solid var(--primary-color);background:rgba(0,0,0,0.03);border-radius:6px;font-size:0.87rem;"><strong>Yanıt:</strong> ' + esc(f.adminNote) + '</div>' : '')
                    + '<div style="color:var(--text-color-light);font-size:0.78rem;margin-top:0.4rem;">' + dateTxt + '</div>'
                    + '</div>';
            });
            listEl.innerHTML = html;
        });
    }

    // Admin yanıt verince "Taleplerim" listesini canlı yenile
    function initFeedbackSocket() {
        if (!window.__socketManager) {
            setTimeout(initFeedbackSocket, 500);
            return;
        }
        window.__socketManager.on('feedback_updated', function () {
            if (document.getElementById('feedback-my-list')) loadMine();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('feedback-form');
        if (!form) return;

        var msgEl = document.getElementById('feedback-message');
        var subjectEl = document.getElementById('feedback-subject');
        var bodyEl = document.getElementById('feedback-msg');

        loadMine();
        initFeedbackSocket();

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var typeInput = form.querySelector('input[name="feedback-type"]:checked');
            var type = typeInput ? typeInput.value : '';
            var subject = subjectEl ? subjectEl.value.trim() : '';
            var message = bodyEl ? bodyEl.value.trim() : '';

            if (!type) { showMsg(msgEl, 'Lütfen öneri veya şikayet seçin.', true); return; }
            if (subject.length < 3) { showMsg(msgEl, 'Konu en az 3 karakter olmalıdır.', true); return; }
            if (message.length < 10) { showMsg(msgEl, 'Mesaj en az 10 karakter olmalıdır.', true); return; }

            var btn = form.querySelector('button[type="submit"]');
            var oldText = btn ? btn.textContent : '';
            if (btn) { btn.disabled = true; btn.textContent = 'Gönderiliyor…'; }
            if (msgEl) { msgEl.style.display = 'none'; }

            try {
                var res = await window.submitFeedback({ type: type, subject: subject, message: message });
                if (res && res.success) {
                    showMsg(msgEl, res.message || 'Talebiniz alındı.', false);
                    form.reset();
                    loadMine();
                } else {
                    showMsg(msgEl, (res && res.message) || 'Gönderilemedi.', true);
                }
            } catch (err) {
                showMsg(msgEl, 'Bir hata oluştu, tekrar deneyin.', true);
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = oldText; }
            }
        });
    });
})();
