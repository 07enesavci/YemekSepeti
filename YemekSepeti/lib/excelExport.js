const ExcelJS = require('exceljs');

// ─────────────────────────────────────────────────────────────────────────────
// Sunucuyu patlatmamak için sınırlar:
// - Detay listeleri SQL'de LIMIT MAX_EXPORT_ROWS ile sınırlanır.
// - Tarih aralığı MAX_EXPORT_RANGE_DAYS ile sınırlıdır (tüm tabloyu tarama engeli).
// - Kırılım (breakdown) sorguları da kendi LIMIT'leriyle sınırlanır.
// - exportLimiter (middleware/security.js) IP başına istek sıklığını kısar.
// Böylece stil/görsel zenginleştirmeye rağmen tek isteğin bellek + DB maliyeti sabit kalır.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_EXPORT_ROWS = 10000;
const MAX_EXPORT_RANGE_DAYS = 366;
const DEFAULT_EXPORT_DAYS = 30;
const MAX_BREAKDOWN_ROWS = 1000;

const APP_NAME = 'Ev Lezzetleri';

// Marka renk paleti (ARGB) — assets/css/main.css :root değişkenleriyle uyumlu.
const C = {
    primary:      'FFDC2626',
    primaryDark:  'FFB91C1C',
    primaryLight: 'FFEF4444',
    primaryTint:  'FFFEE2E2',
    dark:         'FF1F2937',
    darkSoft:     'FF374151',
    white:        'FFFFFFFF',
    success:      'FF059669',
    successTint:  'FFE7F8F1',
    danger:       'FFDC2626',
    dangerTint:   'FFFDECEC',
    amber:        'FFB45309',
    amberTint:    'FFFEF3C7',
    neutralTint:  'FFF3F4F6',
    text:         'FF1F2937',
    textLight:    'FF6B7280',
    zebra:        'FFFBF6F6',
    border:       'FFF1D9D9',
};

const STATUS_TR = {
    pending: 'Beklemede', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor',
    ready: 'Hazır', on_delivery: 'Yolda', delivered: 'Teslim Edildi', cancelled: 'İptal'
};
const STATUS_TONE = {
    delivered: 'success', cancelled: 'danger', on_delivery: 'amber',
    ready: 'amber', pending: 'neutral', confirmed: 'neutral', preparing: 'neutral'
};
const TONE = {
    primary: { fill: C.primaryTint, text: C.primaryDark },
    success: { fill: C.successTint, text: C.success },
    danger:  { fill: C.dangerTint,  text: C.danger  },
    amber:   { fill: C.amberTint,   text: C.amber   },
    neutral: { fill: C.neutralTint, text: C.text    },
};

const MONEY_FMT = '#,##0.00" ₺"';   // 1.234,56 ₺
const INT_FMT = '#,##0';
const DATETIME_FMT = 'dd.mm.yyyy hh:mm';
const DATE_FMT = 'dd.mm.yyyy';

function localizeStatus(raw) {
    return STATUS_TR[raw] || raw || '';
}

// query.startDate / query.endDate ("YYYY-MM-DD") -> { start, end } Date nesneleri.
// Aralık verilmemişse son DEFAULT_EXPORT_DAYS gün kullanılır. Aralık MAX_EXPORT_RANGE_DAYS'i
// aşarsa veya geçersizse { error } döner — böylece çağıran taraf sınırsız bir sorgu atmaz.
function parseExportDateRange(query, { defaultDays = DEFAULT_EXPORT_DAYS } = {}) {
    const { startDate, endDate } = query || {};

    let end = endDate ? new Date(`${endDate}T23:59:59`) : new Date();
    if (isNaN(end.getTime())) return { error: 'Geçersiz bitiş tarihi.' };

    let start;
    if (startDate) {
        start = new Date(`${startDate}T00:00:00`);
        if (isNaN(start.getTime())) return { error: 'Geçersiz başlangıç tarihi.' };
    } else {
        start = new Date(end);
        start.setDate(start.getDate() - defaultDays);
        start.setHours(0, 0, 0, 0);
    }

    if (start > end) return { error: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.' };

    const rangeDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
        return { error: `Tarih aralığı en fazla ${MAX_EXPORT_RANGE_DAYS} gün olabilir. Lütfen aralığı daraltın.` };
    }

    return { start, end };
}

// ── Stil yardımcıları ────────────────────────────────────────────────────────
function solid(argb) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function edge(argb) {
    return { style: 'thin', color: { argb } };
}
function boxBorder(argb) {
    const e = edge(argb);
    return { top: e, left: e, bottom: e, right: e };
}

function fmtRange(start, end) {
    const opt = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return `${start.toLocaleDateString('tr-TR', opt)} – ${end.toLocaleDateString('tr-TR', opt)}`;
}

// Excel sayfa adı: 31 karakter + yasaklı karakterler ( \ / ? * [ ] : ) temizlenir.
const usedNames = new Set();
function sheetName(raw) {
    let n = String(raw || 'Sayfa').replace(/[\\/?*\[\]:]/g, ' ').trim().substring(0, 31) || 'Sayfa';
    let base = n, i = 2;
    while (usedNames.has(n)) { n = `${base.substring(0, 28)} ${i++}`; }
    usedNames.add(n);
    return n;
}

// Başlık afişi (marka bandı) — 1. satır büyük başlık, 2. satır alt bilgi.
function addBanner(sheet, lastCol, title, subtitle) {
    const span = Math.max(lastCol, 3);
    sheet.mergeCells(1, 1, 1, span);
    const t = sheet.getCell(1, 1);
    t.value = `${APP_NAME}   ·   ${title}`;
    t.font = { name: 'Calibri', size: 17, bold: true, color: { argb: C.white } };
    t.fill = solid(C.primary);
    t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(1).height = 38;

    sheet.mergeCells(2, 1, 2, span);
    const s = sheet.getCell(2, 1);
    s.value = subtitle || '';
    s.font = { size: 10.5, bold: true, color: { argb: C.primaryDark } };
    s.fill = solid(C.primaryTint);
    s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(2).height = 22;
}

// KPI kartları bandı: satır çifti (etiket şeridi + değer kutusu), 4 kart/satır.
function addKpiBand(sheet, startRow, kpis) {
    const COLS_PER_CARD = 3;
    const CARDS_PER_ROW = 4;
    let row = startRow;

    for (let i = 0; i < kpis.length; i += CARDS_PER_ROW) {
        const chunk = kpis.slice(i, i + CARDS_PER_ROW);
        const labelRow = sheet.getRow(row);
        const valueRow = sheet.getRow(row + 1);
        labelRow.height = 17;
        valueRow.height = 30;

        chunk.forEach((kpi, idx) => {
            const c1 = idx * COLS_PER_CARD + 1;
            const c2 = c1 + COLS_PER_CARD - 1;
            const tone = TONE[kpi.tone] || TONE.neutral;

            sheet.mergeCells(row, c1, row, c2);
            const label = sheet.getCell(row, c1);
            // Türkçe'ye uygun büyük harf (i→İ, ı→I) — toUpperCase() Türkçe karakterleri bozar.
            label.value = String(kpi.label || '').toLocaleUpperCase('tr-TR');
            label.font = { size: 8.5, bold: true, color: { argb: C.white }, name: 'Calibri' };
            label.fill = solid(C.dark);
            label.alignment = { vertical: 'middle', horizontal: 'center' };
            label.border = { top: edge(C.dark), left: edge(C.dark), right: edge(C.dark) };

            sheet.mergeCells(row + 1, c1, row + 1, c2);
            const value = sheet.getCell(row + 1, c1);
            value.value = kpi.value;
            if (kpi.money) value.numFmt = MONEY_FMT;
            else if (kpi.percent) value.numFmt = '0.0"%"';
            else if (typeof kpi.value === 'number') value.numFmt = INT_FMT;
            value.font = { size: 16, bold: true, color: { argb: tone.text }, name: 'Calibri' };
            value.fill = solid(tone.fill);
            value.alignment = { vertical: 'middle', horizontal: 'center' };
            value.border = { left: edge(C.border), right: edge(C.border), bottom: edge(C.border) };
        });

        row += 3; // etiket + değer + boşluk
    }
    return row;
}

// Küçük anahtar/değer bilgi tablosu (Rapor Bilgileri).
function addInfoBlock(sheet, startRow, rows) {
    let row = startRow;
    sheet.mergeCells(row, 1, row, 12);
    const head = sheet.getCell(row, 1);
    head.value = 'Rapor Bilgileri';
    head.font = { size: 11, bold: true, color: { argb: C.primaryDark } };
    head.alignment = { vertical: 'middle' };
    sheet.getRow(row).height = 22;
    row++;

    rows.forEach((pair) => {
        sheet.mergeCells(row, 1, row, 3);
        sheet.mergeCells(row, 4, row, 12);
        const k = sheet.getCell(row, 1);
        const v = sheet.getCell(row, 4);
        k.value = pair[0];
        k.font = { size: 10, bold: true, color: { argb: C.textLight } };
        k.fill = solid(C.neutralTint);
        k.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        k.border = boxBorder(C.border);
        v.value = pair[1];
        v.font = { size: 10, color: { argb: C.text } };
        v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        v.border = boxBorder(C.border);
        sheet.getRow(row).height = 18;
        row++;
    });
    return row;
}

// Stilli veri tablosu: başlık satırı (marka), zebra desen, kenarlıklar, biçimlendirme.
// headerRowIdx: başlık satırının 1 tabanlı indexi. columns: [{header,key,width,type}].
function addTable(sheet, headerRowIdx, columns, rows, opts = {}) {
    const headerRow = sheet.getRow(headerRowIdx);
    columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.font = { bold: true, color: { argb: C.white }, size: 10.5 };
        cell.fill = solid(C.primary);
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = boxBorder(C.primaryDark);
    });
    headerRow.height = 24;

    let row = headerRowIdx + 1;
    rows.forEach((r, ri) => {
        const dataRow = sheet.getRow(row);
        columns.forEach((col, i) => {
            const cell = dataRow.getCell(i + 1);
            let val = r[col.key];

            if (col.type === 'money') {
                cell.numFmt = MONEY_FMT;
                cell.value = typeof val === 'number' ? val : (parseFloat(val) || 0);
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
            } else if (col.type === 'int') {
                cell.numFmt = INT_FMT;
                cell.value = typeof val === 'number' ? val : (parseInt(val) || 0);
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
            } else if (col.type === 'datetime' || col.type === 'date') {
                cell.numFmt = col.type === 'date' ? DATE_FMT : DATETIME_FMT;
                cell.value = val ? new Date(val) : null;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (col.type === 'status') {
                const tone = TONE[STATUS_TONE[val] || 'neutral'];
                cell.value = localizeStatus(val);
                cell.font = { size: 10, bold: true, color: { argb: tone.text } };
                cell.fill = solid(tone.fill);
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = boxBorder(C.border);
                return; // status kendi font/fill'ini kullanır, zebra uygulanmaz
            } else {
                cell.value = val != null && val !== '' ? val : '—';
                cell.alignment = { vertical: 'middle', horizontal: col.align || 'left', indent: col.align ? 0 : 1 };
            }

            if (!cell.font) cell.font = { size: 10, color: { argb: C.text } };
            cell.border = boxBorder(C.border);
            if (ri % 2 === 1) cell.fill = solid(C.zebra);
        });
        dataRow.height = 18;
        row++;
    });

    if (rows.length === 0) {
        sheet.mergeCells(row, 1, row, columns.length);
        const e = sheet.getCell(row, 1);
        e.value = opts.emptyText || 'Seçilen tarih aralığında kayıt bulunamadı.';
        e.font = { italic: true, color: { argb: C.textLight }, size: 10 };
        e.fill = solid(C.neutralTint);
        e.alignment = { horizontal: 'center', vertical: 'middle' };
        e.border = boxBorder(C.border);
        sheet.getRow(row).height = 26;
        row++;
    }

    if (opts.note) {
        row++;
        sheet.mergeCells(row, 1, row, columns.length);
        const n = sheet.getCell(row, 1);
        n.value = `⚠ ${opts.note}`;
        n.font = { italic: true, bold: true, color: { argb: C.amber }, size: 9.5 };
        n.alignment = { horizontal: 'left', vertical: 'middle' };
        row++;
    }

    columns.forEach((col, i) => {
        sheet.getColumn(i + 1).width = col.width || 16;
    });

    if (rows.length > 0) {
        sheet.autoFilter = {
            from: { row: headerRowIdx, column: 1 },
            to: { row: headerRowIdx, column: columns.length }
        };
    }
    return row;
}

// ── Özet sayfası: afiş + KPI kartları + rapor bilgileri ──────────────────────
function buildSummarySheet(sheet, report) {
    addBanner(sheet, 12, report.title, report.subtitle);
    let row = 4;
    if (report.kpis && report.kpis.length) {
        row = addKpiBand(sheet, row, report.kpis) + 1;
    }
    if (report.info && report.info.length) {
        row = addInfoBlock(sheet, row, report.info) + 1;
    }
    // Footer
    sheet.mergeCells(row, 1, row, 12);
    const f = sheet.getCell(row, 1);
    f.value = `${APP_NAME} · Yemek Sipariş & Teslimat Platformu — otomatik oluşturulan rapor`;
    f.font = { italic: true, size: 9, color: { argb: C.textLight } };

    for (let c = 1; c <= 12; c++) sheet.getColumn(c).width = 11.5;
}

// ── Veri sayfası: afiş + stilli tablo, başlık satırında dondurulmuş ──────────
function buildDataSheet(sheet, report, def) {
    const lastCol = def.columns.length;
    addBanner(sheet, lastCol, report.title, `${def.heading} · ${report.subtitle}`);
    sheet.getRow(3).height = 6;
    const headerRowIdx = 4;
    addTable(sheet, headerRowIdx, def.columns, def.rows, { note: def.note, emptyText: def.emptyText });
    sheet.views = [{ state: 'frozen', ySplit: headerRowIdx, showGridLines: false }];
}

// report: { fileName, title, subtitle, kpis:[], info:[[k,v]], sheets:[{name,heading,columns,rows,note}] }
async function writeReport(res, report) {
    usedNames.clear();
    const wb = new ExcelJS.Workbook();
    wb.creator = APP_NAME;
    wb.company = APP_NAME;
    wb.created = new Date();
    wb.title = report.title;

    const ozet = wb.addWorksheet(sheetName('Özet'), { views: [{ showGridLines: false }] });
    buildSummarySheet(ozet, report);

    for (const def of (report.sheets || [])) {
        const ws = wb.addWorksheet(sheetName(def.name));
        buildDataSheet(ws, report, def);
    }

    const fileName = report.fileName || 'Ev-Lezzetleri-Rapor.xlsx';
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    await wb.xlsx.write(res);
    res.end();
}

module.exports = {
    MAX_EXPORT_ROWS,
    MAX_EXPORT_RANGE_DAYS,
    MAX_BREAKDOWN_ROWS,
    DEFAULT_EXPORT_DAYS,
    APP_NAME,
    STATUS_TR,
    localizeStatus,
    fmtRange,
    parseExportDateRange,
    writeReport
};
