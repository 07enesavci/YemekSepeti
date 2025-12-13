// =================================================================
// YEMEK EKLEME/DÜZENLEME MODAL FONKSİYONLARI
// =================================================================

/**
 * Yemek ekleme modal'ını aç
 */
function openAddMealModal() {
    const modal = document.getElementById('meal-modal');
    if (!modal) {
        // Modal yoksa oluştur
        createMealModal();
    }
    
    const modalInstance = document.getElementById('meal-modal');
    const modalTitle = document.getElementById('meal-modal-title');
    const mealForm = document.getElementById('meal-form');
    
    if (modalTitle) modalTitle.textContent = 'Yeni Yemek Ekle';
    if (mealForm) {
        mealForm.reset();
        mealForm.setAttribute('data-meal-id', '');
        
        // Resim seçeneklerini sıfırla
        const imageOptionFile = document.getElementById('image-option-file');
        const imageOptionUrl = document.getElementById('image-option-url');
        const imageFileContainer = document.getElementById('image-file-container');
        const imageUrlContainer = document.getElementById('image-url-container');
        const mealImagePreview = document.getElementById('meal-image-preview');
        
        if (imageOptionFile) imageOptionFile.checked = true;
        if (imageOptionUrl) imageOptionUrl.checked = false;
        if (imageFileContainer) imageFileContainer.style.display = 'block';
        if (imageUrlContainer) imageUrlContainer.style.display = 'none';
        if (mealImagePreview) {
            mealImagePreview.src = '';
            mealImagePreview.style.display = 'none';
        }
    }
    
    modalInstance.style.display = 'flex';
}

/**
 * Yemek düzenleme modal'ını aç (mealId ile)
 */
function openEditMealModal(mealId) {
    // Bu fonksiyon artık kullanılmıyor, openEditMealModalWithData kullanılacak
    console.warn('openEditMealModal(mealId) deprecated, use openEditMealModalWithData(meal) instead');
}

/**
 * Yemek düzenleme modal'ını aç (meal objesi ile)
 */
function openEditMealModalWithData(meal) {
    const modal = document.getElementById('meal-modal');
    if (!modal) {
        createMealModal();
    }
    
    const modalInstance = document.getElementById('meal-modal');
    const modalTitle = document.getElementById('meal-modal-title');
    const mealForm = document.getElementById('meal-form');
    
    const nameInput = document.getElementById('meal-name');
    const categoryInput = document.getElementById('meal-category');
    const priceInput = document.getElementById('meal-price');
    const descriptionInput = document.getElementById('meal-description');
    const mealImageFile = document.getElementById('meal-image-file');
    const mealImageUrl = document.getElementById('meal-image-url');
    const mealImagePreview = document.getElementById('meal-image-preview');
    const imageOptionFile = document.getElementById('image-option-file');
    const imageOptionUrl = document.getElementById('image-option-url');
    const imageFileContainer = document.getElementById('image-file-container');
    const imageUrlContainer = document.getElementById('image-url-container');
    const availableInput = document.getElementById('meal-available');
    
    if (nameInput) nameInput.value = meal.name || '';
    if (categoryInput) categoryInput.value = meal.category || '';
    if (priceInput) priceInput.value = meal.price || '';
    if (descriptionInput) descriptionInput.value = meal.description || '';
    if (availableInput) availableInput.checked = meal.isAvailable !== false;
    if (mealForm) mealForm.setAttribute('data-meal-id', meal.id);
    if (modalTitle) modalTitle.textContent = 'Yemek Düzenle';
    
    // Resim ayarları
    if (meal.imageUrl) {
        // Eğer URL varsa ve /uploads/ ile başlıyorsa (yüklenmiş dosya), dosya seçeneğini göster
        if (meal.imageUrl.startsWith('/uploads/')) {
            if (imageOptionFile) imageOptionFile.checked = true;
            if (imageOptionUrl) imageOptionUrl.checked = false;
            if (imageFileContainer) imageFileContainer.style.display = 'block';
            if (imageUrlContainer) imageUrlContainer.style.display = 'none';
            if (mealImagePreview) {
                mealImagePreview.src = meal.imageUrl;
                mealImagePreview.style.display = 'block';
            }
        } else {
            // URL ise URL seçeneğini göster
            if (imageOptionFile) imageOptionFile.checked = false;
            if (imageOptionUrl) imageOptionUrl.checked = true;
            if (imageFileContainer) imageFileContainer.style.display = 'none';
            if (imageUrlContainer) imageUrlContainer.style.display = 'block';
            if (mealImageUrl) mealImageUrl.value = meal.imageUrl;
        }
    } else {
        // Resim yoksa dosya seçeneğini göster
        if (imageOptionFile) imageOptionFile.checked = true;
        if (imageOptionUrl) imageOptionUrl.checked = false;
        if (imageFileContainer) imageFileContainer.style.display = 'block';
        if (imageUrlContainer) imageUrlContainer.style.display = 'none';
    }
    
    modalInstance.style.display = 'flex';
}

/**
 * Yemek modal'ını oluştur
 */
function createMealModal() {
    const modalHTML = `
        <div id="meal-modal" class="modal-overlay" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="meal-modal-title">Yeni Yemek Ekle</h2>
                    <button class="modal-close" onclick="closeMealModal()">&times;</button>
                </div>
                <form id="meal-form">
                    <div class="form-group">
                        <label for="meal-name" class="form-label">Yemek Adı *</label>
                        <input type="text" id="meal-name" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label for="meal-category" class="form-label">Kategori *</label>
                        <select id="meal-category" class="form-input" required>
                            <option value="">Seçiniz</option>
                            <option value="Ana Yemekler">Ana Yemekler</option>
                            <option value="Tatlılar">Tatlılar</option>
                            <option value="İçecekler">İçecekler</option>
                            <option value="Salatalar">Salatalar</option>
                            <option value="Çorbalar">Çorbalar</option>
                            <option value="Atıştırmalıklar">Atıştırmalıklar</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="meal-description" class="form-label">Açıklama</label>
                        <textarea id="meal-description" class="form-input" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="meal-price" class="form-label">Fiyat (TL) *</label>
                        <input type="number" id="meal-price" class="form-input" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Resim Seçeneği</label>
                        <div style="margin-bottom: 10px;">
                            <label style="margin-right: 20px; cursor: pointer;">
                                <input type="radio" name="image-option" value="file" id="image-option-file" checked> Dosya Yükle
                            </label>
                            <label style="cursor: pointer;">
                                <input type="radio" name="image-option" value="url" id="image-option-url"> URL Gir
                            </label>
                        </div>
                        <div id="image-file-container" style="display: block;">
                            <input type="file" id="meal-image-file" class="form-input" accept="image/*">
                            <img id="meal-image-preview" src="" alt="Önizleme" style="max-width: 200px; max-height: 200px; margin-top: 10px; display: none; border-radius: 8px;">
                        </div>
                        <div id="image-url-container" style="display: none;">
                            <input type="url" id="meal-image-url" class="form-input" placeholder="https://example.com/image.jpg">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" id="meal-available" checked> Satışta
                        </label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeMealModal()">İptal</button>
                        <button type="submit" class="btn btn-primary">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Image option değiştiğinde container'ları göster/gizle
    const imageOptionFile = document.getElementById('image-option-file');
    const imageOptionUrl = document.getElementById('image-option-url');
    const imageFileContainer = document.getElementById('image-file-container');
    const imageUrlContainer = document.getElementById('image-url-container');
    const mealImageFile = document.getElementById('meal-image-file');
    const mealImagePreview = document.getElementById('meal-image-preview');
    
    if (imageOptionFile && imageOptionUrl && imageFileContainer && imageUrlContainer) {
        imageOptionFile.addEventListener('change', () => {
            imageFileContainer.style.display = 'block';
            imageUrlContainer.style.display = 'none';
        });
        
        imageOptionUrl.addEventListener('change', () => {
            imageFileContainer.style.display = 'none';
            imageUrlContainer.style.display = 'block';
        });
    }
    
    // Dosya seçildiğinde önizleme göster
    if (mealImageFile && mealImagePreview) {
        mealImageFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Dosya boyutu kontrolü (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('❌ Resim çok büyük! Maksimum 5MB olmalı.');
                    e.target.value = '';
                    mealImagePreview.style.display = 'none';
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    mealImagePreview.src = e.target.result;
                    mealImagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                mealImagePreview.style.display = 'none';
            }
        });
    }
    
    // Form submit handler
    const mealForm = document.getElementById('meal-form');
    if (mealForm) {
        mealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const mealId = mealForm.getAttribute('data-meal-id');
            const imageOption = document.querySelector('input[name="image-option"]:checked')?.value || 'file';
            
            let imageUrl = null;
            
            // Resim URL'ini belirle
            if (imageOption === 'file') {
                const fileInput = document.getElementById('meal-image-file');
                const file = fileInput?.files[0];
                
                if (file) {
                    // Dosyayı yükle
                    try {
                        console.log('📤 Resim yükleniyor...', file.name, file.size, 'bytes');
                        const formData = new FormData();
                        formData.append('image', file);
                        
                        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                        const uploadUrl = `${baseUrl}/api/upload/meal/image`;
                        console.log('📤 Upload URL:', uploadUrl);
                        
                        const uploadResponse = await fetch(uploadUrl, {
                            method: 'POST',
                            credentials: 'include',
                            body: formData
                        });
                        
                        console.log('📥 Upload response status:', uploadResponse.status);
                        
                        if (!uploadResponse.ok) {
                            const errorText = await uploadResponse.text();
                            console.error('❌ Upload hatası:', errorText);
                            let error;
                            try {
                                error = JSON.parse(errorText);
                            } catch {
                                error = { message: errorText || 'Resim yüklenemedi' };
                            }
                            throw new Error(error.message || 'Resim yüklenemedi');
                        }
                        
                        const uploadData = await uploadResponse.json();
                        console.log('📥 Upload response data:', uploadData);
                        
                        if (uploadData.success && uploadData.url) {
                            imageUrl = uploadData.url;
                            console.log('✅ Resim yüklendi:', imageUrl);
                        } else {
                            throw new Error(uploadData.message || 'Resim URL alınamadı');
                        }
                    } catch (error) {
                        console.error('❌ Resim yükleme hatası:', error);
                        alert('❌ Resim yükleme hatası: ' + error.message);
                        return;
                    }
                } else {
                    console.log('⚠️ Dosya seçilmedi');
                }
            } else {
                // URL'den al
                const urlInput = document.getElementById('meal-image-url');
                const urlValue = urlInput?.value?.trim();
                if (urlValue && urlValue !== '') {
                    imageUrl = urlValue;
                    console.log('📝 Resim URL:', imageUrl);
                } else {
                    imageUrl = null;
                    console.log('⚠️ URL boş, imageUrl null olarak ayarlandı');
                }
            }
            
            const mealData = {
                name: document.getElementById('meal-name').value,
                category: document.getElementById('meal-category').value,
                description: document.getElementById('meal-description').value,
                price: parseFloat(document.getElementById('meal-price').value),
                imageUrl: imageUrl, // imageUrl null olabilir, bu normal
                isAvailable: document.getElementById('meal-available').checked
            };
            
            console.log('📦 Meal data:', mealData);
            console.log('📦 Image URL:', mealData.imageUrl);
            
            try {
                if (mealId) {
                    // Düzenleme
                    console.log('🔄 Yemek güncelleniyor...', mealId);
                    await window.updateMeal(parseInt(mealId), mealData);
                    alert('✅ Yemek başarıyla güncellendi!');
                } else {
                    // Ekleme
                    console.log('➕ Yemek ekleniyor...');
                    await window.addMeal(mealData);
                    alert('✅ Yemek başarıyla eklendi!');
                }
                
                closeMealModal();
                // Menüyü yeniden yükle
                if (window.loadMenuPage) {
                    await window.loadMenuPage();
                } else {
                    location.reload();
                }
            } catch (error) {
                alert('❌ Hata: ' + error.message);
            }
        });
    }
}

/**
 * Yemek modal'ını kapat
 */
function closeMealModal() {
    const modal = document.getElementById('meal-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Modal overlay'e tıklanınca kapat
document.addEventListener('click', (e) => {
    const modal = document.getElementById('meal-modal');
    if (e.target === modal) {
        closeMealModal();
    }
});

// Global fonksiyonlar
window.openAddMealModal = openAddMealModal;
window.openEditMealModal = openEditMealModal;
window.openEditMealModalWithData = openEditMealModalWithData;
window.closeMealModal = closeMealModal;
window.createMealModal = createMealModal;

