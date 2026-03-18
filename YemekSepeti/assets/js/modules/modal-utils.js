window.showConfirm = function(message) {
    return new Promise((resolve) => {
        let modal = document.getElementById('custom-confirm-modal');
        if (!modal) {
            const modalHtml = `
                <div id="custom-confirm-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 99999; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);">
                    <div class="modal-content" style="max-width: 400px; width: 90%; padding: 2rem; text-align: center; background: var(--card-bg, #fff); border-radius: 16px; border: 1px solid var(--border-color, transparent); box-shadow: var(--card-shadow, 0 20px 60px rgba(0,0,0,0.15)); transform: translateY(20px); opacity: 0; transition: all 0.3s ease;">
                        <h3 style="margin-bottom: 1rem; font-size: 1.25rem; color: var(--text-color, #1a1a2e); font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600;">Onay Gerekli</h3>
                        <p id="custom-confirm-message" style="margin-bottom: 2rem; color: var(--text-color-light, #666); font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 0.95rem; line-height: 1.6;"></p>
                        <div style="display: flex; gap: 1rem; justify-content: center;">
                            <button id="custom-confirm-cancel" class="btn" style="flex: 1; padding: 0.85rem 1.5rem; border: 2px solid #c0392b; background: transparent; color: #c0392b; border-radius: 8px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease;">İPTAL</button>
                            <button id="custom-confirm-ok" class="btn" style="flex: 1; padding: 0.85rem 1.5rem; border: none; background: #c0392b; color: #fff; border-radius: 8px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease;">TAMAM</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('custom-confirm-modal');
        }

        const msgEl = document.getElementById('custom-confirm-message');
        if (msgEl) msgEl.textContent = message;
        
        modal.style.display = 'flex';
        // Trigger reflow for animation
        void modal.offsetWidth;
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'translateY(0)';
            content.style.opacity = '1';
        }

        const okBtn = document.getElementById('custom-confirm-ok');
        const cancelBtn = document.getElementById('custom-confirm-cancel');

        const newOkBtn = okBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        const closeModal = (result) => {
            if (content) {
                content.style.transform = 'translateY(-20px)';
                content.style.opacity = '0';
            }
            setTimeout(() => {
                modal.style.display = 'none';
                resolve(result);
            }, 200); // Wait for transition
        };

        newCancelBtn.addEventListener('click', () => closeModal(false));
        newOkBtn.addEventListener('click', () => closeModal(true));
    });
};

window.showAlert = function(message) {
    return new Promise((resolve) => {
        let modal = document.getElementById('custom-alert-modal');
        if (!modal) {
            const modalHtml = `
                <div id="custom-alert-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 99999; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);">
                    <div class="modal-content" style="max-width: 400px; width: 90%; padding: 2rem; text-align: center; background: var(--card-bg, #fff); border-radius: 16px; border: 1px solid var(--border-color, transparent); box-shadow: var(--card-shadow, 0 20px 60px rgba(0,0,0,0.15)); transform: translateY(20px); opacity: 0; transition: all 0.3s ease;">
                        <h3 style="margin-bottom: 1rem; font-size: 1.25rem; color: var(--text-color, #1a1a2e); font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600;">Bilgilendirme</h3>
                        <p id="custom-alert-message" style="margin-bottom: 2rem; color: var(--text-color-light, #666); font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 0.95rem; line-height: 1.6;"></p>
                        <div style="display: flex; justify-content: center;">
                            <button id="custom-alert-ok" class="btn" style="min-width: 140px; padding: 0.85rem 1.5rem; border: none; background: #c0392b; color: #fff; border-radius: 8px; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease;">TAMAM</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('custom-alert-modal');
        }

        const msgEl = document.getElementById('custom-alert-message');
        if (msgEl) msgEl.textContent = message;
        
        // Save to session storage in case of immediate page reload
        try {
            sessionStorage.setItem('ys_pending_alert', message);
        } catch (e) {}

        modal.style.display = 'flex';
        // Trigger reflow for animation
        void modal.offsetWidth;
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'translateY(0)';
            content.style.opacity = '1';
        }

        const okBtn = document.getElementById('custom-alert-ok');
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);

        const closeModal = () => {
            try {
                sessionStorage.removeItem('ys_pending_alert');
            } catch (e) {}
            
            if (content) {
                content.style.transform = 'translateY(-20px)';
                content.style.opacity = '0';
            }
            setTimeout(() => {
                modal.style.display = 'none';
                resolve(true);
            }, 200); // Wait for transition
        };

        newOkBtn.addEventListener('click', closeModal);
    });
};

// Override native window.alert globally
window.alert = function(msg) {
    window.showAlert(msg);
};

// Check for pending alerts immediately when this script runs
try {
    const pendingMsg = sessionStorage.getItem('ys_pending_alert');
    if (pendingMsg) {
        sessionStorage.removeItem('ys_pending_alert');
        // Wait for DOM to be ready before showing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => window.showAlert(pendingMsg));
        } else {
            window.showAlert(pendingMsg);
        }
    }
} catch (e) {}
