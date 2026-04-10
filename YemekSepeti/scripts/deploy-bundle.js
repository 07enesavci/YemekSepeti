/**
 * Canlı paket: tek Node uygulamasının tam kopyasını
 * canli-dagitim/YemekSepeti/PAKET-TAM-UYGULAMA/ altına yazar.
 * Sunucuda: cd PAKET-TAM-UYGULAMA && npm ci && .env oluştur && pm2 start
 */
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(appRoot, 'canli-dagitim', 'YemekSepeti', 'PAKET-TAM-UYGULAMA');

function shouldExclude(relPosix) {
    if (!relPosix) return false;
    const seg = relPosix.split('/');
    const top = seg[0];
    if (top === 'node_modules' || top === '.git' || top === 'logs') return true;
    if (top === 'canli-dagitim') return true;
    if (top === '.env') return true;
    if (relPosix === '.env') return true;
    return false;
}

function copyDir(src, dest, root) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const e of entries) {
        const from = path.join(src, e.name);
        const rel = path.relative(root, from).split(path.sep).join('/');
        if (shouldExclude(rel)) continue;
        const to = path.join(dest, e.name);
        if (e.isDirectory()) {
            fs.mkdirSync(to, { recursive: true });
            copyDir(from, to, root);
        } else {
            fs.mkdirSync(path.dirname(to), { recursive: true });
            fs.copyFileSync(from, to);
        }
    }
}

console.log('Kaynak:', appRoot);
console.log('Hedef:', outDir);

if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

for (const name of fs.readdirSync(appRoot, { withFileTypes: true })) {
    const from = path.join(appRoot, name.name);
    const rel = name.name;
    if (shouldExclude(rel)) continue;
    const to = path.join(outDir, name.name);
    if (name.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        copyDir(from, to, appRoot);
    } else {
        fs.copyFileSync(from, to);
    }
}

console.log('Tamam. Sunucuya yükleyeceğiniz klasör:', path.relative(appRoot, outDir));
