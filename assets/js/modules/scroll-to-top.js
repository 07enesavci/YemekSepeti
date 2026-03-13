let scrollToTopButton = null;

function createScrollToTopButton() {
    if (document.getElementById('scroll-to-top-btn')) {
        return;
    }
    
    const button = document.createElement('button');
    button.id = 'scroll-to-top-btn';
    button.className = 'scroll-to-top-btn';
    button.setAttribute('aria-label', 'En üste çık');
    button.innerHTML = '↑';
    button.style.display = 'none';
    button.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    document.body.appendChild(button);
    scrollToTopButton = button;
    function adjustButtonPosition() {
        if (window.innerWidth <= 480) {
            button.style.bottom = '1rem';
        } else if (window.innerWidth <= 768) {
            button.style.bottom = '1.5rem';
        } else {
            button.style.bottom = '2rem';
        }
    }
    adjustButtonPosition();
    window.addEventListener('resize', adjustButtonPosition);
    setTimeout(adjustButtonPosition, 1000);
    window.addEventListener('scroll', toggleScrollToTopButton);
    toggleScrollToTopButton();
}

function toggleScrollToTopButton() {
    if (!scrollToTopButton) return;
    
    if (window.pageYOffset > 300 || document.documentElement.scrollTop > 300) {
        scrollToTopButton.style.display = 'flex';
    } else {
        scrollToTopButton.style.display = 'none';
    }
}

async function checkAndShowScrollToTop() {
    const path = window.location.pathname;
    const isPanelPage = path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/');
    if (isPanelPage) {
        createScrollToTopButton();
        return;
    }
    const isAuthPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') ||
                       window.location.pathname.includes('/forgot-password') ||
                       window.location.pathname.includes('/reset-password');
    if (isAuthPage) {
        return;
    }
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
        try {
            const user = JSON.parse(cachedUser);
            if (user.role === 'seller' || user.role === 'courier' || user.role === 'admin') {
                createScrollToTopButton();
                return;
            }
        } catch (e) {
        }
    }
    createScrollToTopButton();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShowScrollToTop);
} else {
    checkAndShowScrollToTop();
}

