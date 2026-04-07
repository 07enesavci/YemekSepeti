(function () {
    const STORAGE_KEY = 'ys_delivery_area';
    let pendingLat = null;
    let pendingLng = null;
    let formWired = false;

    function apiBase() {
        if (typeof window.getBaseUrl !== 'function') return '';
        return String(window.getBaseUrl()).replace(/\/$/, '');
    }

    /** Örn. /api/... veya tam origin+path (Live Server → 3000 proxy) */
    function addressApiUrl(path) {
        const p = path.startsWith('/') ? path : `/${path}`;
        const b = apiBase();
        return b ? `${b}${p}` : p;
    }

    function pathExcluded() {
        const p = window.location.pathname || '';
        if (p.startsWith('/seller') || p.startsWith('/courier') || p.startsWith('/admin')) return true;
        if (p === '/login' || p === '/register' || p === '/forgot-password' || p === '/reset-password') return true;
        if (p.startsWith('/register/documents')) return true;
        return false;
    }

    function readStored() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (
                !o ||
                typeof o.il !== 'string' ||
                !o.il.trim() ||
                typeof o.ilce !== 'string' ||
                !o.ilce.trim() ||
                typeof o.mahalle !== 'string' ||
                !o.mahalle.trim() ||
                typeof o.cadde !== 'string' ||
                !o.cadde.trim()
            ) {
                return null;
            }
            const out = {
                il: o.il.trim(),
                ilce: o.ilce.trim(),
                mahalle: o.mahalle.trim(),
                cadde: o.cadde.trim()
            };
            if (o.lat != null && o.lng != null && !Number.isNaN(Number(o.lat)) && !Number.isNaN(Number(o.lng))) {
                out.lat = Number(o.lat);
                out.lng = Number(o.lng);
            }
            if (o.source) out.source = o.source;
            return out;
        } catch (e) {
            return null;
        }
    }

    function persistLocal(data) {
        const copy = { ...data };
        if (copy.lat != null) copy.lat = Number(copy.lat);
        if (copy.lng != null) copy.lng = Number(copy.lng);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
        if (copy.lat != null && copy.lng != null) {
            try {
                localStorage.setItem('ys-user-location', JSON.stringify({ lat: copy.lat, lng: copy.lng }));
            } catch (e) {}
        }
        pendingLat = null;
        pendingLng = null;
        try {
            document.dispatchEvent(new CustomEvent('ys-delivery-area-updated', { detail: copy, bubbles: true }));
        } catch (e) {}
    }

    function refreshHeaderChip() {
        const textEl = document.getElementById('header-delivery-text');
        const chip = document.getElementById('header-delivery-chip');
        if (!textEl) return;
        const d = readStored();
        if (d) {
            const short = `${d.ilce}, ${d.il}`;
            textEl.textContent = short.length > 36 ? short.slice(0, 34) + '…' : short;
            if (chip) chip.setAttribute('title', `${d.mahalle}, ${d.cadde} — ${d.ilce}, ${d.il}`);
        } else {
            textEl.textContent = 'Konum seçin';
            if (chip) chip.removeAttribute('title');
        }
    }

    function showOverlay(overlay) {
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('delivery-area-modal-open');
    }

    function hideOverlay(overlay) {
        try {
            const ae = document.activeElement;
            if (overlay && ae && overlay.contains(ae) && typeof ae.blur === 'function') {
                ae.blur();
            }
        } catch (e) {}
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('delivery-area-modal-open');
    }

    async function postSession(data) {
        const body = { ...data };
        if (data.lat != null && data.lng != null) {
            body.lat = data.lat;
            body.lng = data.lng;
        }
        try {
            const r = await fetch(addressApiUrl('/api/address/delivery-context'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body)
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.success) {
                return j.message || 'Sunucuya kaydedilemedi.';
            }
            return null;
        } catch (e) {
            return 'Bağlantı hatası.';
        }
    }

    async function loadCities(selectEl) {
        const res = await fetch(addressApiUrl('/api/address/cities'), { credentials: 'same-origin' });
        const j = await res.json();
        if (!j.success || !Array.isArray(j.cities)) throw new Error('İller yüklenemedi.');
        selectEl.innerHTML = '<option value="">İl seçin</option>';
        j.cities.forEach((c) => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            selectEl.appendChild(opt);
        });
    }

    async function loadDistricts(city, selectIlce) {
        const enc = encodeURIComponent(city);
        const res = await fetch(addressApiUrl(`/api/address/districts/${enc}`), { credentials: 'same-origin' });
        const j = await res.json();
        if (!res.ok || !j.success || !Array.isArray(j.districts)) {
            selectIlce.innerHTML = '<option value="">İlçe bulunamadı</option>';
            selectIlce.disabled = true;
            return;
        }
        selectIlce.innerHTML = '<option value="">İlçe seçin</option>';
        j.districts.forEach((d) => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            selectIlce.appendChild(opt);
        });
        selectIlce.disabled = false;
    }

    async function fillFormFromStored() {
        const stored = readStored();
        const selIl = document.getElementById('delivery-il');
        const selIlce = document.getElementById('delivery-ilce');
        const inpMah = document.getElementById('delivery-mahalle');
        const inpCad = document.getElementById('delivery-cadde');
        if (!selIl || !selIlce || !inpMah || !inpCad) return;
        await loadCities(selIl);
        if (stored) {
            selIl.value = stored.il;
            await loadDistricts(stored.il, selIlce);
            selIlce.value = stored.ilce;
            inpMah.value = stored.mahalle;
            inpCad.value = stored.cadde;
            if (stored.lat != null && stored.lng != null) {
                pendingLat = stored.lat;
                pendingLng = stored.lng;
            }
        } else {
            inpMah.value = '';
            inpCad.value = '';
        }
    }

    function openDeliveryModal(opts) {
        const mode = opts && opts.mode === 'edit' ? 'edit' : 'blocking';
        const overlay = document.getElementById('delivery-area-overlay');
        const buyerStep = document.getElementById('delivery-step-buyer');
        const formStep = document.getElementById('delivery-step-form');
        if (!overlay || !buyerStep || !formStep) return;
        buyerStep.hidden = true;
        formStep.hidden = false;
        if (mode === 'edit') {
            overlay.classList.add('delivery-area-overlay--dismissible');
        } else {
            overlay.classList.remove('delivery-area-overlay--dismissible');
        }
        fillFormFromStored().catch(() => {});
        showOverlay(overlay);
        setTimeout(() => {
            try {
                document.getElementById('delivery-il') && document.getElementById('delivery-il').focus();
            } catch (e) {}
        }, 80);
    }

    async function applyPayload(overlay, payload, errEl) {
        if (errEl) {
            errEl.hidden = true;
            errEl.textContent = '';
        }
        const submitBtn = document.getElementById('delivery-area-submit');
        if (submitBtn) submitBtn.disabled = true;
        const data = { ...payload };
        if (pendingLat != null && pendingLng != null) {
            data.lat = pendingLat;
            data.lng = pendingLng;
        }
        const serverErr = await postSession(data);
        if (submitBtn) submitBtn.disabled = false;
        if (serverErr) {
            if (errEl) {
                errEl.textContent = serverErr;
                errEl.hidden = false;
            }
            return;
        }
        try {
            window.__buyerAddressPromptPending = false;
        } catch (e) {}
        persistLocal(data);
        hideOverlay(overlay);
        refreshHeaderChip();
    }

    function showBuyerPicker(opts) {
        opts = opts || {};
        const dismissible = opts.dismissible === true;
        const overlay = document.getElementById('delivery-area-overlay');
        const buyerStep = document.getElementById('delivery-step-buyer');
        const formStep = document.getElementById('delivery-step-form');
        const errEl = document.getElementById('delivery-buyer-error');
        const loadingEl = document.getElementById('delivery-buyer-loading');
        const listEl = document.getElementById('delivery-buyer-list');
        const guestBtn = document.getElementById('delivery-buyer-use-guest');
        if (!overlay || !buyerStep || !formStep || !listEl) return;
        buyerStep.hidden = false;
        formStep.hidden = true;
        showOverlay(overlay);
        if (dismissible) {
            overlay.classList.add('delivery-area-overlay--dismissible');
        } else {
            overlay.classList.remove('delivery-area-overlay--dismissible');
        }
        if (errEl) {
            errEl.hidden = true;
            errEl.textContent = '';
        }
        const guest = readStored();
        if (guestBtn) {
            guestBtn.hidden = !guest;
            guestBtn.onclick = () => {
                if (!guest) return;
                pendingLat = guest.lat != null ? guest.lat : null;
                pendingLng = guest.lng != null ? guest.lng : null;
                applyPayload(overlay, guest, errEl);
            };
        }
        listEl.innerHTML = '';
        if (loadingEl) loadingEl.hidden = false;
        fetch(addressApiUrl('/api/buyer/addresses'), { credentials: 'same-origin' })
            .then((r) => r.json())
            .then((j) => {
                if (loadingEl) loadingEl.hidden = true;
                if (!j.success || !Array.isArray(j.data)) {
                    if (errEl) {
                        errEl.textContent = 'Adresler yüklenemedi.';
                        errEl.hidden = false;
                    }
                    return;
                }
                j.data.forEach((addr) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'delivery-buyer-item';
                    btn.setAttribute('role', 'listitem');
                    const t = document.createElement('strong');
                    t.textContent = addr.title || 'Adres';
                    const s = document.createElement('span');
                    s.className = 'delivery-buyer-item-sub';
                    s.textContent = [addr.district, addr.city].filter(Boolean).join(', ') || addr.detail || '';
                    btn.appendChild(t);
                    btn.appendChild(s);
                    btn.addEventListener('click', () => {
                        const latNum = addr.latitude != null && addr.latitude !== '' ? Number(addr.latitude) : null;
                        const lngNum = addr.longitude != null && addr.longitude !== '' ? Number(addr.longitude) : null;
                        pendingLat = latNum != null && !Number.isNaN(latNum) ? latNum : null;
                        pendingLng = lngNum != null && !Number.isNaN(lngNum) ? lngNum : null;
                        const cadde = (addr.fullDetail || addr.detail || '').trim();
                        const ilce = (addr.district || 'Merkez').trim();
                        const il = (addr.city || '').trim();
                        applyPayload(
                            overlay,
                            {
                                il,
                                ilce,
                                mahalle: (addr.title || 'Adres').trim(),
                                cadde: cadde.slice(0, 120) || ilce.slice(0, 120),
                                source: 'saved'
                            },
                            errEl
                        );
                    });
                    listEl.appendChild(btn);
                });
            })
            .catch(() => {
                if (loadingEl) loadingEl.hidden = true;
                if (errEl) {
                    errEl.textContent = 'Adresler yüklenemedi.';
                    errEl.hidden = false;
                }
            });
    }

    function wireFormOnce() {
        if (formWired) return;
        formWired = true;
        const overlay = document.getElementById('delivery-area-overlay');
        const form = document.getElementById('delivery-area-form');
        const selIl = document.getElementById('delivery-il');
        const selIlce = document.getElementById('delivery-ilce');
        const inpMah = document.getElementById('delivery-mahalle');
        const inpCad = document.getElementById('delivery-cadde');
        const errEl = document.getElementById('delivery-area-error');
        const gpsBtn = document.getElementById('delivery-use-gps-btn');
        const newBtn = document.getElementById('delivery-buyer-new-btn');

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target !== overlay) return;
                if (!overlay.classList.contains('delivery-area-overlay--dismissible')) return;
                hideOverlay(overlay);
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (!overlay || overlay.hidden) return;
            if (!overlay.classList.contains('delivery-area-overlay--dismissible')) return;
            hideOverlay(overlay);
        });

        if (newBtn) {
            newBtn.addEventListener('click', () => {
                const buyerStep = document.getElementById('delivery-step-buyer');
                const formStep = document.getElementById('delivery-step-form');
                if (buyerStep) buyerStep.hidden = true;
                if (formStep) formStep.hidden = false;
                fillFormFromStored().catch(() => {});
            });
        }

        if (selIl) {
            selIl.addEventListener('change', () => {
                const city = selIl.value;
                selIlce.innerHTML = '<option value="">Yükleniyor...</option>';
                selIlce.disabled = true;
                if (!city) {
                    selIlce.innerHTML = '<option value="">Önce il seçin</option>';
                    return;
                }
                loadDistricts(city, selIlce).catch(() => {
                    selIlce.innerHTML = '<option value="">İlçeler yüklenemedi</option>';
                    selIlce.disabled = true;
                });
            });
        }

        if (gpsBtn) {
            function showGpsError(msg) {
                if (!errEl) return;
                errEl.textContent = msg;
                errEl.hidden = false;
                try {
                    errEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                } catch (e) {}
            }

            function geoErrorMessage(err) {
                if (!err) return 'Konum alınamadı.';
                if (typeof window.isSecureContext !== 'undefined' && !window.isSecureContext) {
                    return 'Bu adres (ör. ağ IP’si) güvenli sayılmıyor; tarayıcı konumu engelleyebilir. http://localhost, http://127.0.0.1 veya HTTPS deneyin.';
                }
                const code = err.code;
                if (code === 1) {
                    return 'Konum erişimi reddedildi. Adres çubuğundaki kilit / bilgi simgesinden bu site için Konum iznini “İzin ver” yapın.';
                }
                if (code === 2) {
                    return 'Cihaz konum bilgisi veremedi. Windows’ta Ayarlar > Gizlilik ve güvenlik > Konum açık olsun; mümkünse Wi‑Fi açık deneyin.';
                }
                if (code === 3) {
                    return 'Konum zaman aşımına uğradı. Tekrar deneyin veya elle girin.';
                }
                return err.message || 'Konum alınamadı.';
            }

            function getPositionWithWatchFallback() {
                return new Promise((resolve, reject) => {
                    let settled = false;
                    let watchId = null;
                    const timeoutMs = 28000;
                    const tid = setTimeout(() => {
                        if (settled) return;
                        settled = true;
                        try {
                            if (watchId != null) navigator.geolocation.clearWatch(watchId);
                        } catch (e) {}
                        reject(Object.assign(new Error('timeout'), { code: 3 }));
                    }, timeoutMs);
                    watchId = navigator.geolocation.watchPosition(
                        (pos) => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(tid);
                            try {
                                if (watchId != null) navigator.geolocation.clearWatch(watchId);
                            } catch (e) {}
                            resolve(pos);
                        },
                        () => {},
                        { enableHighAccuracy: true, maximumAge: 0 }
                    );
                });
            }

            async function getPositionWithRetry() {
                const attempts = [
                    { enableHighAccuracy: false, timeout: 45000, maximumAge: 0 },
                    { enableHighAccuracy: true, timeout: 45000, maximumAge: 0 },
                    { enableHighAccuracy: false, timeout: 70000, maximumAge: 300000 }
                ];
                let lastErr;
                for (const opts of attempts) {
                    try {
                        return await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, opts);
                        });
                    } catch (e) {
                        lastErr = e;
                        if (e && e.code === 1) throw e;
                    }
                }
                try {
                    return await getPositionWithWatchFallback();
                } catch (e) {
                    throw lastErr || e;
                }
            }

            function applyIlIlceFromNearCity(j, selIlEl, selIlceEl, lat, lng) {
                pendingLat = lat;
                pendingLng = lng;
                selIlEl.value = j.il;
                return loadDistricts(j.il, selIlceEl).then(() => {
                    const wanted = j.ilce || '';
                    const opts = Array.from(selIlceEl.options || []);
                    const has = opts.some((o) => o.value === wanted);
                    selIlceEl.value = has ? wanted : (opts[1] && opts[1].value) || '';
                });
            }

            gpsBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (!navigator.geolocation) {
                    showGpsError('Tarayıcı konum desteklemiyor.');
                    return;
                }
                gpsBtn.disabled = true;
                const old = gpsBtn.textContent;
                gpsBtn.textContent = 'Konum alınıyor…';
                (async () => {
                    try {
                        let pos;
                        try {
                            pos = await getPositionWithRetry();
                        } catch (geoErr) {
                            showGpsError(geoErrorMessage(geoErr));
                            return;
                        }
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        try {
                            const url = addressApiUrl(
                                `/api/address/near-city?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
                            );
                            const r = await fetch(url, { credentials: 'include', mode: 'cors' });
                            const j = await r.json().catch(() => ({}));
                            if (!r.ok || !j.success || !j.il) {
                                throw new Error((j && j.message) || 'Sunucu konumu çözümleyemedi.');
                            }
                            await loadCities(selIl);
                            await applyIlIlceFromNearCity(j, selIl, selIlce, lat, lng);
                            if (errEl) {
                                errEl.hidden = true;
                                errEl.textContent = '';
                            }
                        } catch (e2) {
                            showGpsError((e2 && e2.message) || 'Konum bu adrese çevrilemedi. Elle girin.');
                        }
                    } finally {
                        gpsBtn.disabled = false;
                        gpsBtn.textContent = old;
                    }
                })();
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const il = selIl.value.trim();
                const ilce = selIlce.value.trim();
                const mahalle = inpMah.value.trim();
                const cadde = inpCad.value.trim();
                if (!il || !ilce || !mahalle || !cadde) {
                    if (errEl) {
                        errEl.textContent = 'Tüm alanları doldurun.';
                        errEl.hidden = false;
                    }
                    return;
                }
                await applyPayload(overlay, { il, ilce, mahalle, cadde, source: 'manual' }, errEl);
            });
        }
    }

    function init() {
        wireFormOnce();
        if (pathExcluded()) {
            const chip = document.getElementById('header-delivery-chip');
            if (chip) chip.hidden = true;
            return;
        }
        const chip = document.getElementById('header-delivery-chip');
        if (chip) {
            chip.hidden = false;
            chip.addEventListener('click', () => {
                const buyerLoggedIn =
                    window.__userRole === 'buyer' && String(window.__userId || '').trim() !== '';
                if (buyerLoggedIn) {
                    showBuyerPicker({ dismissible: true });
                } else {
                    openDeliveryModal({ mode: 'edit' });
                }
            });
        }
        refreshHeaderChip();

        if (sessionStorage.getItem('ys_prompt_buyer_delivery') === '1' && window.__userRole === 'buyer') {
            sessionStorage.removeItem('ys_prompt_buyer_delivery');
            try {
                window.__buyerAddressPromptPending = true;
            } catch (e) {}
            showBuyerPicker();
            return;
        }
        if (!readStored()) {
            openDeliveryModal({ mode: 'blocking' });
        }
    }

    window.getDeliveryArea = function () {
        return readStored();
    };

    window.openDeliveryAreaModal = function (opts) {
        opts = opts || { mode: 'edit' };
        const buyerLoggedIn =
            window.__userRole === 'buyer' && String(window.__userId || '').trim() !== '';
        if (opts.mode !== 'blocking' && buyerLoggedIn) {
            showBuyerPicker({ dismissible: true });
            return;
        }
        openDeliveryModal(opts);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
