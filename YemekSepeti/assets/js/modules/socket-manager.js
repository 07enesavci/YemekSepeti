/**
 * Global Socket Manager v2
 * - Tek bağlantı, role-based room join
 * - Ses sistemi: kullanıcı ilk tıkladığında AudioContext unlock edilir,
 *   sonrasında tüm bildirimler WebAudio API ile çalar (fallback: SpeechSynthesis)
 * - Toast kuyruğu: üst üste gelen bildirimler sıralı gösterilir
 * - Kurye & Satıcı & Müşteri için eksiksiz bildirim seti
 */

window.__socketManager = (function () {
    let socket = null;
    let isConnected = false;
    const currentRole = window.__userRole || '';
    const currentUserId = window.__userId || '';
    const listeners = {};

    /* ── Audio ──────────────────────────────────────────────── */
    let audioCtx = null;
    let audioUnlocked = false;

    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function unlockAudio() {
        if (audioUnlocked) return;
        try {
            const ctx = getAudioCtx();
            // Sessiz bir oscilator çalarak context'i unlock et
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.001);
            if (ctx.state === 'suspended') {
                ctx.resume().then(() => { audioUnlocked = true; });
            } else {
                audioUnlocked = true;
            }
        } catch (e) { /* tarayıcı izin vermedi, speech fallback kullanılacak */ }
    }

    // İlk kullanıcı etkileşiminde unlock et
    ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(evt => {
        document.addEventListener(evt, unlockAudio, { once: false, passive: true });
    });

    /* Ses tipleri:
     *  new_order        → çift zil (satıcı + genel)
     *  order_cancelled  → alçalan alarm (satıcı + kurye)
     *  courier_task     → kısa yükselen bip (kurye)
     *  status_update    → tek kısa bip (müşteri)
     *  delivered        → parlak zil (müşteri)
     */
    function playSound(type) {
        return new Promise((resolve) => {
            try {
                const ctx = getAudioCtx();
                if (audioUnlocked && ctx.state === 'running') {
                    const t = ctx.currentTime;

                    const beep = (freq, start, dur, shape = 'sine', vol = 0.7) => {
                        const osc = ctx.createOscillator();
                        const g = ctx.createGain();
                        osc.type = shape;
                        osc.frequency.value = freq;
                        g.gain.setValueAtTime(0, start);
                        g.gain.linearRampToValueAtTime(vol, start + 0.03);
                        g.gain.linearRampToValueAtTime(0, start + dur);
                        osc.connect(g);
                        g.connect(ctx.destination);
                        osc.start(start);
                        osc.stop(start + dur + 0.05);
                    };

                    if (type === 'new_order') {
                        beep(880, t, 0.18, 'triangle', 0.8);
                        beep(1100, t + 0.22, 0.18, 'triangle', 0.8);
                        setTimeout(resolve, 450);
                    } else if (type === 'order_cancelled') {
                        beep(440, t, 0.25, 'sawtooth', 0.7);
                        beep(300, t + 0.3, 0.3, 'sawtooth', 0.7);
                        setTimeout(resolve, 680);
                    } else if (type === 'courier_task' || type === 'courier_available') {
                        beep(600, t, 0.12, 'square', 0.5);
                        beep(800, t + 0.15, 0.12, 'square', 0.5);
                        beep(1000, t + 0.3, 0.15, 'square', 0.6);
                        setTimeout(resolve, 500);
                    } else if (type === 'delivered') {
                        beep(1200, t, 0.1, 'triangle', 0.6);
                        beep(1500, t + 0.13, 0.15, 'triangle', 0.7);
                        setTimeout(resolve, 320);
                    } else if (type === 'status_update') {
                        beep(700, t, 0.15, 'sine', 0.5);
                        setTimeout(resolve, 200);
                    } else if (type === 'account_approved') {
                        beep(880, t, 0.12, 'triangle', 0.6);
                        beep(1100, t + 0.15, 0.12, 'triangle', 0.6);
                        beep(1320, t + 0.30, 0.18, 'triangle', 0.7);
                        setTimeout(resolve, 520);
                    } else if (type === 'account_rejected') {
                        beep(400, t, 0.2, 'sawtooth', 0.6);
                        beep(300, t + 0.25, 0.25, 'sawtooth', 0.6);
                        setTimeout(resolve, 550);
                    } else {
                        resolve();
                    }
                    return;
                }
            } catch (e) { /* WebAudio başarısız */ }

            // Fallback: SpeechSynthesis
            if ('speechSynthesis' in window) {
                const texts = {
                    new_order: 'Yeni sipariş geldi',
                    order_cancelled: 'Sipariş iptal edildi',
                    courier_task: 'Yeni teslimat görevi',
                    courier_available: 'Yeni teslimat görevi',
                    delivered: 'Sipariş teslim edildi',
                    status_update: 'Sipariş güncellendi',
                    account_approved: 'Hesabınız onaylandı',
                    account_rejected: 'Başvurunuz reddedildi'
                };
                const text = texts[type];
                if (text) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(text);
                    u.lang = 'tr-TR';
                    u.rate = 1.4;
                    u.onend = resolve;
                    u.onerror = resolve;
                    window.speechSynthesis.speak(u);
                    return;
                }
            }
            resolve();
        });
    }

    /* ── Toast + Ses Kuyruğu ────────────────────────────────── */
    const notifQueue = [];
    const soundQueue = [];
    let isSoundBusy = false;

    function notifyQueue(type, data, textFallback) {
        notifQueue.push({ type, data, textFallback });
        processNotifQueue();
    }

    function processNotifQueue() {
        // Bekleyen tüm toastları hemen göster — ses ayrı kuyruğa gider
        while (notifQueue.length > 0) {
            const task = notifQueue.shift();
            showToast(task);
            soundQueue.push(task.type);
        }
        processSoundQueue();
    }

    function processSoundQueue() {
        if (isSoundBusy || soundQueue.length === 0) return;
        isSoundBusy = true;
        const type = soundQueue.shift();
        playSound(type).then(() => {
            isSoundBusy = false;
            processSoundQueue();
        }).catch(() => {
            isSoundBusy = false;
            processSoundQueue();
        });
    }

    const TOAST_CONFIG = {
        new_order: {
            icon: '🔔',
            title: 'Yeni Sipariş!',
            color: '#2E7D32',
            border: '#66BB6A'
        },
        order_cancelled: {
            icon: '🚫',
            title: 'Sipariş İptal Edildi',
            color: '#B71C1C',
            border: '#EF5350'
        },
        courier_task: {
            icon: '🛵',
            title: 'Yeni Teslimat Görevi',
            color: '#0D47A1',
            border: '#42A5F5'
        },
        courier_available: {
            icon: '📦',
            title: 'Yeni Sipariş Havuzda',
            color: '#1565C0',
            border: '#64B5F6'
        },
        status_update: {
            icon: 'ℹ️',
            title: 'Sipariş Güncellendi',
            color: '#E65100',
            border: '#FFA726'
        },
        account_approved: {
            icon: '✅',
            title: 'Hesabınız Onaylandı!',
            color: '#1B5E20',
            border: '#66BB6A'
        },
        account_rejected: {
            icon: '❌',
            title: 'Başvurunuz Reddedildi',
            color: '#B71C1C',
            border: '#EF5350'
        },
        delivered: {
            icon: '✅',
            title: 'Teslim Edildi!',
            color: '#1B5E20',
            border: '#81C784'
        },
        courier_rejected: {
            icon: '⚠️',
            title: 'Kurye Görevi Reddetti',
            color: '#4A148C',
            border: '#CE93D8'
        }
    };

    function showToast(task) {
        const cfg = TOAST_CONFIG[task.type] || { icon: '📢', title: 'Bildirim', color: '#424242', border: '#9E9E9E' };

        let subtitle = task.textFallback || '';
        const d = task.data || {};

        if (!subtitle) {
            if (task.type === 'new_order') {
                subtitle = d.orderNumber ? `#${d.orderNumber} · ${d.totalAmount ? Number(d.totalAmount).toFixed(2) + ' TL' : ''}` : 'Sipariş alındı.';
            } else if (task.type === 'order_cancelled') {
                const by = d.cancelledBy === 'buyer' ? 'Müşteri' : d.cancelledBy === 'seller' ? 'Satıcı' : '';
                subtitle = d.orderNumber ? `#${d.orderNumber}${by ? ' · ' + by + ' tarafından' : ''}` : 'İptal edildi.';
            } else if (task.type === 'courier_task') {
                subtitle = d.orderId ? `Sipariş #${d.orderId} atandı.` : 'Yeni görev atandı.';
            } else if (task.type === 'courier_available') {
                subtitle = 'Çevrende yeni bir teslimat var.';
            } else if (task.type === 'delivered') {
                subtitle = d.orderNumber ? `#${d.orderNumber} teslim edildi.` : 'Siparişiniz teslim edildi.';
            } else if (task.type === 'courier_rejected') {
                subtitle = 'Görev reddedildi, yeni kurye aranıyor.';
            }
        }

        // Mevcut toast sayısına göre dikey kaydır
        const existingToasts = document.querySelectorAll('.sm-toast');
        const topOffset = 20 + (existingToasts.length * 90);

        const el = document.createElement('div');
        el.className = 'sm-toast';
        el.style.cssText = `
            position: fixed;
            top: ${topOffset}px;
            right: 20px;
            z-index: 99999;
            background: ${cfg.color};
            border-left: 4px solid ${cfg.border};
            color: #fff;
            padding: 14px 18px;
            border-radius: 10px;
            box-shadow: 0 8px 28px rgba(0,0,0,0.28);
            display: flex;
            align-items: flex-start;
            gap: 12px;
            font-size: 14px;
            font-weight: 500;
            max-width: 380px;
            min-width: 260px;
            animation: smSlideIn 0.28s ease-out;
            cursor: pointer;
        `;

        el.innerHTML = `
            <span style="font-size:22px;line-height:1;flex-shrink:0">${cfg.icon}</span>
            <div style="flex:1;min-width:0">
                <strong style="display:block;margin-bottom:3px;font-size:15px">${cfg.title}</strong>
                <small style="opacity:0.9;word-break:break-word">${subtitle}</small>
            </div>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,0.8);font-size:18px;cursor:pointer;padding:0;flex-shrink:0;line-height:1">&times;</button>
        `;

        // CSS inject (bir kez)
        if (!document.getElementById('sm-toast-styles')) {
            const s = document.createElement('style');
            s.id = 'sm-toast-styles';
            s.textContent = `
                @keyframes smSlideIn {
                    from { transform: translateX(420px); opacity: 0; }
                    to   { transform: translateX(0);     opacity: 1; }
                }
                @keyframes smSlideOut {
                    from { transform: translateX(0);     opacity: 1; }
                    to   { transform: translateX(420px); opacity: 0; }
                }
                .sm-toast { transition: top 0.2s ease; }
            `;
            document.head.appendChild(s);
        }

        document.body.appendChild(el);

        // Tıklayınca da kapat
        el.addEventListener('click', () => el.remove());

        // 6 saniye sonra otomatik kapat
        setTimeout(() => {
            if (!el.parentElement) return;
            el.style.animation = 'smSlideOut 0.28s ease-in forwards';
            setTimeout(() => el.remove(), 280);
        }, 6000);
    }

    /* ── Socket ─────────────────────────────────────────────── */
    function init() {
        if (typeof io === 'undefined') {
            setTimeout(init, 500);
            return;
        }
        if (socket) return;

        console.log(`[SocketManager] Bağlanıyor... Rol: ${currentRole || 'guest'} | ID: ${currentUserId || '-'}`);

        socket = io({
            query: {
                userId: currentUserId || 'guest',
                role: currentRole || 'guest'
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity
        });

        window.__appSocket = socket;

        socket.on('connect', () => {
            isConnected = true;
            console.log('[SocketManager] ✅ Bağlandı:', socket.id);
            trigger('connect');
        });

        socket.on('disconnect', (reason) => {
            isConnected = false;
            console.log('[SocketManager] ❌ Koptu:', reason);
            trigger('disconnect', reason);
        });

        // Tüm eventleri yakala ve ilgili dinleyicilere ilet
        const originalOnevent = socket.onevent;
        socket.onevent = function (packet) {
            const args = packet.data || [];
            const evName = args[0];
            const evData = args[1];
            console.log(`[SocketManager] 📨 ${evName}`, evData);
            trigger(evName, evData);
            if (originalOnevent) originalOnevent.call(this, packet);
        };
    }

    function on(eventName, cb) {
        if (!listeners[eventName]) listeners[eventName] = [];
        listeners[eventName].push(cb);
    }

    function off(eventName, cb) {
        if (!listeners[eventName]) return;
        listeners[eventName] = cb
            ? listeners[eventName].filter(f => f !== cb)
            : [];
    }

    function trigger(eventName, data) {
        (listeners[eventName] || []).forEach(cb => {
            try { cb(data); } catch (e) {
                console.error(`[SocketManager] Event handler hatası (${eventName}):`, e);
            }
        });
    }

    function emit(eventName, data) {
        if (socket && isConnected) {
            socket.emit(eventName, data);
        } else {
            console.warn(`[SocketManager] Bağlı değil, '${eventName}' gönderilemedi.`);
        }
    }

    return { init, on, off, emit, notifyQueue, getSocket: () => socket, isConnected: () => isConnected };
})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.__socketManager.init(), 100);
});
