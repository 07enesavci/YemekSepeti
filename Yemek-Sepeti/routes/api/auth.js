const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../config/database");

// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================

// JWT Token oluştur
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || "yemek-sepeti-super-secret-key-2025",
        { expiresIn: "7d" }
    );
}

// Şifre hashle
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// Şifre karşılaştır
async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

// ============================================
// LOGIN ENDPOINT
// ============================================

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    console.log("🔐 Login isteği alındı:", { email, password: "***" });

    try {
        // Kullanıcıyı veritabanından bul
        const users = await db.query("SELECT id, email, password, fullname, role FROM users WHERE email = ?", [email]);

        if (!users || users.length === 0) {
            console.log("❌ Kullanıcı bulunamadı veya şifre hatalı");
            return res.status(401).json({ 
                success: false, 
                message: "E-posta veya şifre yanlış." 
            });
        }

        const user = users[0];

        // Admin kontrolü (özel durum)
        if ((email === "admin@gmail.com" || email === "admin@mail.com") && password === "admin") {
            const token = generateToken(user);
            const userData = {
                id: user.id,
                email: user.email,
                fullname: user.fullname || "Admin",
                role: "admin"
            };
            console.log("✅ Admin girişi başarılı");
            return res.json({
                success: true,
                user: userData,
                token: token
            });
        }

        // Şifre kontrolü
        const isMatch = await comparePassword(password, user.password);
        
        if (!isMatch) {
            console.log("❌ Şifre hatalı");
            return res.status(401).json({ 
                success: false, 
                message: "E-posta veya şifre yanlış." 
            });
        }

        // Token oluştur
        const token = generateToken(user);
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };

        console.log("✅ Login başarılı:", { email: user.email, role: user.role });

        res.json({
            success: true,
            user: userData,
            token: token
        });

    } catch (error) {
        console.error("Login hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. Giriş yapılamadı." 
        });
    }
});

// ============================================
// REGISTER ENDPOINT
// ============================================

router.post("/register", async (req, res) => {
    const { fullname, email, password, role = "buyer" } = req.body;

    console.log("📝 Register isteği alındı:", { fullname, email, role });

    try {
        // E-posta kontrolü
        const existingUsers = await db.query("SELECT id FROM users WHERE email = ?", [email]);
        
        if (existingUsers && existingUsers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Bu e-posta adresi zaten kayıtlı." 
            });
        }

        // Şifreyi hashle
        const hashedPassword = await hashPassword(password);

        // Kullanıcıyı kaydet
        const result = await db.execute(
            "INSERT INTO users (email, password, fullname, role) VALUES (?, ?, ?, ?)",
            [email, hashedPassword, fullname, role]
        );

        const userId = result.insertId;

        // Token oluştur
        const user = {
            id: userId,
            email: email,
            fullname: fullname,
            role: role
        };
        const token = generateToken(user);

        console.log("✅ Kayıt başarılı:", { userId, email, role });

        res.status(201).json({
            success: true,
            user: user,
            token: token
        });

    } catch (error) {
        console.error("Register hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. Kayıt yapılamadı." 
        });
    }
});

// ============================================
// FORGOT PASSWORD ENDPOINT
// ============================================

router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    console.log("🔑 Şifre sıfırlama isteği alındı:", { email });

    try {
        // Kullanıcıyı bul
        const users = await db.query("SELECT id, email FROM users WHERE email = ?", [email]);

        if (!users || users.length === 0) {
            // Güvenlik için: Kullanıcı yoksa da aynı mesajı döndür
            return res.json({
                success: true,
                message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
            });
        }

        // TODO: E-posta gönderme işlemi burada yapılacak
        // Şimdilik sadece başarı mesajı döndürüyoruz

        console.log("✅ Şifre sıfırlama e-postası gönderildi (simüle):", { email });

        res.json({
            success: true,
            message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
        });

    } catch (error) {
        console.error("Forgot password hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. İşlem yapılamadı." 
        });
    }
});

module.exports = router;
