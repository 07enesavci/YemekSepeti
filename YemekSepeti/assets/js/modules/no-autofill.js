/**
 * Genel Otomatik Doldurma Kapatıcı
 * Hafızada tutulması istenmeyen metin alanlarında tarayıcının eski değerleri
 * önermesini (form geçmişi / autofill) engeller. Örn: doğrulama kodu, kargo takip no,
 * kupon kodu, arama kutuları, kart alanları vb.
 *
 * Korunanlar (dokunulmaz):
 *  - Açıkça autocomplete verilmiş alanlar (one-time-code, new-password, cc-*, email vb.)
 *  - Kimlik alanları: type=email, type=password  → tarayıcı/parola yöneticisi çalışsın
 *  - Metin dışı tipler (checkbox, radio, file, date, range, renk vb.)
 *
 * Dinamik olarak (modal, kart formu, sipariş kartı) eklenen alanlar da
 * MutationObserver ile yakalanır.
 */
(function () {
    'use strict';

    var SKIP_TYPES = {
        password: 1, email: 1, hidden: 1, checkbox: 1, radio: 1, file: 1,
        submit: 1, button: 1, image: 1, reset: 1, range: 1, color: 1,
        date: 1, 'datetime-local': 1, month: 1, week: 1, time: 1
    };

    function apply(el) {
        if (!el || !el.tagName) return;
        var tag = el.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') return;
        // Açıkça belirtilmiş autocomplete varsa saygı göster (bilinçli tercih)
        if (el.hasAttribute('autocomplete')) return;
        if (tag === 'input') {
            var type = (el.getAttribute('type') || 'text').toLowerCase();
            if (SKIP_TYPES[type]) return;
        }
        el.setAttribute('autocomplete', 'off');
    }

    function sweep(root) {
        try {
            var nodes = (root || document).querySelectorAll('input, textarea');
            for (var i = 0; i < nodes.length; i++) apply(nodes[i]);
        } catch (e) { /* sessiz geç */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { sweep(document); });
    } else {
        sweep(document);
    }

    // Dinamik eklenen alanlar için gözlemci
    if (window.MutationObserver) {
        var mo = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (!node || node.nodeType !== 1) continue;
                    var tag = node.tagName ? node.tagName.toLowerCase() : '';
                    if (tag === 'input' || tag === 'textarea') apply(node);
                    if (node.querySelectorAll) sweep(node);
                }
            }
        });
        (function start() {
            if (document.body) {
                mo.observe(document.body, { childList: true, subtree: true });
            } else {
                setTimeout(start, 50);
            }
        })();
    }
})();
