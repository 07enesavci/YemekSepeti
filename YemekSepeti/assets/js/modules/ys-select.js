/**
 * YS-Select: Modern arama destekli custom select bileşeni.
 * Panel body'e eklenir — overflow:hidden olan parent'lar tarafından kesilemez.
 * Kullanım: initYsSelects(containerOrSelector)
 */
window.initYsSelects = function(root) {
    var container = (typeof root === 'string') ? document.querySelector(root) : (root || document);
    if (!container) return;

    container.querySelectorAll('select:not(.ys-select-original):not(.ys-skip)').forEach(function(select) {
        if (select.classList.contains('ys-select-original')) return;
        select.classList.add('ys-select-original');

        var wrapper = document.createElement('div');
        wrapper.className = 'ys-select-wrapper';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        var trigger = document.createElement('div');
        trigger.className = 'ys-select-trigger' + (select.disabled ? ' disabled' : '');
        trigger.innerHTML = '<span class="ys-select-text">' + (select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : '') + '</span><span class="ys-select-arrow">&#9660;</span>';
        wrapper.appendChild(trigger);

        // Panel body'e eklenir — overflow:hidden clipping engellensin
        var panel = document.createElement('div');
        panel.className = 'ys-select-panel ys-portal';
        panel.innerHTML = '<div class="ys-select-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" placeholder="Ara..."></div><ul class="ys-select-list"></ul><div class="ys-select-empty">Sonuç bulunamadı</div>';
        document.body.appendChild(panel);

        var list = panel.querySelector('.ys-select-list');
        var searchInput = panel.querySelector('input');
        var emptyMsg = panel.querySelector('.ys-select-empty');
        var textSpan = trigger.querySelector('.ys-select-text');

        function renderOptions() {
            list.innerHTML = '';
            Array.from(select.options).forEach(function(opt) {
                var li = document.createElement('li');
                li.textContent = opt.text;
                li.dataset.value = opt.value;
                if (opt.selected) li.classList.add('selected');
                li.addEventListener('click', function(e) {
                    e.stopPropagation();
                    select.value = opt.value;
                    textSpan.textContent = opt.text;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    closePanel();
                    Array.from(list.children).forEach(function(c) { c.classList.remove('selected'); });
                    li.classList.add('selected');
                });
                list.appendChild(li);
            });
        }
        renderOptions();

        select.syncCustomUI = function() {
            renderOptions();
            var sel = select.options[select.selectedIndex];
            textSpan.textContent = sel ? sel.text : '';
            if (select.disabled) trigger.classList.add('disabled');
            else trigger.classList.remove('disabled');
        };

        function positionPanel() {
            var rect = trigger.getBoundingClientRect();
            var spaceBelow = window.innerHeight - rect.bottom;
            var panelHeight = panel.scrollHeight || 280;

            panel.style.width = rect.width + 'px';
            panel.style.left = (rect.left + window.scrollX) + 'px';

            if (spaceBelow < panelHeight + 10 && rect.top > panelHeight + 10) {
                // Yukarı aç
                panel.style.top = (rect.top + window.scrollY - panelHeight - 5) + 'px';
            } else {
                // Aşağı aç
                panel.style.top = (rect.bottom + window.scrollY + 5) + 'px';
            }
        }

        function openPanel() {
            if (select.disabled || trigger.classList.contains('disabled')) return;
            // Diğer açık panelleri kapat
            document.querySelectorAll('.ys-select-panel.ys-portal.open').forEach(function(p) {
                p.classList.remove('open');
            });
            document.querySelectorAll('.ys-select-trigger.open').forEach(function(t) {
                t.classList.remove('open');
            });
            positionPanel();
            trigger.classList.add('open');
            panel.classList.add('open');
            searchInput.value = '';
            filterList('');
            setTimeout(function() { searchInput.focus(); }, 50);
        }

        function closePanel() {
            trigger.classList.remove('open');
            panel.classList.remove('open');
        }

        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            panel.classList.contains('open') ? closePanel() : openPanel();
        });

        searchInput.addEventListener('input', function(e) {
            filterList(e.target.value.trim().toLowerCase());
        });

        // Panel içinde click — dışarı yayılmasın (belge listener kapatmasın)
        panel.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        function filterList(query) {
            var hasVisible = false;
            Array.from(list.children).forEach(function(li) {
                var match = li.textContent.toLowerCase().indexOf(query) !== -1;
                li.classList.toggle('hidden', !match);
                if (match) hasVisible = true;
            });
            emptyMsg.style.display = hasVisible ? 'none' : 'block';
        }

        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) closePanel();
        });

        // Scroll / resize — açık panelin konumunu güncelle
        window.addEventListener('scroll', function() {
            if (panel.classList.contains('open')) positionPanel();
        }, true);
        window.addEventListener('resize', function() {
            if (panel.classList.contains('open')) positionPanel();
        });
    });
};
