/**
 * Sidebar Manager — Fixed & Improved
 */

class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.collapseBtn = document.getElementById('collapseBtn');
        this.body = document.body;
        this.menuLinks = document.querySelectorAll('.menu-link');
        this.isCollapsed = false;
        this.isMobile = window.innerWidth <= 640;
        this.activeMenu = 'dashboard';

        // Create overlay element for mobile
        this.overlay = this._createOverlay();
        // Create mobile hamburger button
        this.mobileBtn = this._createMobileBtn();

        this.init();
    }

    _createOverlay() {
        let overlay = document.getElementById('sidebarOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sidebarOverlay';
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }
        overlay.addEventListener('click', () => this.closeMobileSidebar());
        return overlay;
    }

    _createMobileBtn() {
        let btn = document.getElementById('mobileMenuBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'mobileMenuBtn';
            btn.className = 'mobile-menu-btn';
            btn.setAttribute('aria-label', 'Open menu');
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
            document.body.appendChild(btn);
        }
        btn.addEventListener('click', () => this.toggleMobileSidebar());
        return btn;
    }

    init() {
        this.attachEventListeners();
        this.applySavedState();
        // Set initial body margin for desktop
        if (!this.isMobile) {
            this._applyDesktopBodyClass();
        }
    }

    attachEventListeners() {
        // Desktop collapse button
        this.collapseBtn?.addEventListener('click', () => {
            if (!this.isMobile) {
                this.toggleDesktopSidebar();
            }
        });

        // Menu links
        this.menuLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleMenuClick(e));
        });

        // Window resize — debounced
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.handleResize(), 100);
        });

        // Keyboard shortcut: Ctrl/Cmd + B
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                if (this.isMobile) {
                    this.toggleMobileSidebar();
                } else {
                    this.toggleDesktopSidebar();
                }
            }
        });
    }

    // ===== Desktop Toggle =====

    toggleDesktopSidebar() {
        this.isCollapsed = !this.isCollapsed;
        this.sidebar.classList.toggle('collapsed', this.isCollapsed);
        this._applyDesktopBodyClass();
        this.saveState();
    }

    _applyDesktopBodyClass() {
        this.body.classList.toggle('sidebar-collapsed', this.isCollapsed);
    }

    // ===== Mobile Toggle =====

    toggleMobileSidebar() {
        const isOpen = this.sidebar.classList.contains('mobile-open');
        if (isOpen) {
            this.closeMobileSidebar();
        } else {
            this.openMobileSidebar();
        }
    }

    openMobileSidebar() {
        this.sidebar.classList.add('mobile-open');
        this.overlay.classList.add('active');
        this.body.style.overflow = 'hidden'; // prevent scroll behind overlay
    }

    closeMobileSidebar() {
        this.sidebar.classList.remove('mobile-open');
        this.overlay.classList.remove('active');
        this.body.style.overflow = '';
    }

    // ===== Menu Click =====

    handleMenuClick(e) {
        const link = e.currentTarget;
        const menuName = link.getAttribute('data-menu');

        // Update active state
        this.menuLinks.forEach(l => l.closest('.menu-item')?.classList.remove('active'));
        link.closest('.menu-item')?.classList.add('active');
        this.activeMenu = menuName;
        this.saveState();

        // Ripple
        this.createRipple(e);

        // Close mobile sidebar after navigation
        if (this.isMobile) {
            setTimeout(() => this.closeMobileSidebar(), 180);
        }

        // Analytics
        this.trackMenuClick(menuName);
    }

    createRipple(e) {
        const button = e.currentTarget;
        const existing = button.querySelectorAll('.ripple');
        existing.forEach(r => r.remove()); // clean old ripples

        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
        ripple.classList.add('ripple');
        button.appendChild(ripple);

        // Auto-remove after animation
        ripple.addEventListener('animationend', () => ripple.remove());
    }

    // ===== Resize Handler =====

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 640;

        if (wasMobile === this.isMobile) return; // no change

        if (this.isMobile) {
            // Switched to mobile: remove desktop classes, close sidebar
            this.sidebar.classList.remove('collapsed');
            this.closeMobileSidebar();
            this.body.classList.remove('sidebar-collapsed');
            this.body.style.overflow = '';
        } else {
            // Switched to desktop: close mobile state, restore desktop
            this.closeMobileSidebar();
            this.body.style.overflow = '';
            // Re-apply saved collapse state
            if (this.isCollapsed) {
                this.sidebar.classList.add('collapsed');
            } else {
                this.sidebar.classList.remove('collapsed');
            }
            this._applyDesktopBodyClass();
        }
    }

    // ===== State Persistence =====

    saveState() {
        try {
            localStorage.setItem('sidebarState', JSON.stringify({
                collapsed: this.isCollapsed,
                activeMenu: this.activeMenu
            }));
        } catch(e) { /* storage might be blocked */ }
    }

    applySavedState() {
        try {
            // Detect active menu from current URL first — more reliable than localStorage
            const urlMenu = this._detectMenuFromPath(window.location.pathname);
            if (urlMenu) {
                this.activeMenu = urlMenu;
            } else {
                const saved = localStorage.getItem('sidebarState');
                if (saved) {
                    const state = JSON.parse(saved);
                    this.activeMenu = state.activeMenu || 'dashboard';
                }
            }

            // Restore active menu highlight
            this.menuLinks.forEach(l => l.closest('.menu-item')?.classList.remove('active'));
            const activeLink = document.querySelector(`[data-menu="${this.activeMenu}"]`);
            if (activeLink) {
                activeLink.closest('.menu-item')?.classList.add('active');
            }

            // Restore collapse state from localStorage
            const saved = localStorage.getItem('sidebarState');
            if (saved) {
                const state = JSON.parse(saved);
                this.isCollapsed = !!state.collapsed;
            }

            // Apply desktop collapse state
            if (!this.isMobile && this.isCollapsed) {
                this.sidebar.classList.add('collapsed');
            }
        } catch(e) {
            console.warn('Could not restore sidebar state:', e);
        }
    }

    _detectMenuFromPath(path) {
        // Normalise: strip trailing slash, default to '/'
        const norm = p => p.replace(/\/$/, '') || '/';
        const current = norm(path);
        for (const link of this.menuLinks) {
            const href = link.getAttribute('href');
            if (!href) continue;
            if (norm(href) === current) return link.getAttribute('data-menu');
        }
        return null;
    }

    // ===== Analytics =====

    trackMenuClick(menu) {
        if (window.gtag) {
            gtag('event', 'sidebar_navigation', { menu_item: menu });
        }
    }

    // ===== Public API =====

    getState() {
        return {
            isCollapsed: this.isCollapsed,
            isMobile: this.isMobile,
            activeMenu: this.activeMenu
        };
    }

    navigateTo(menu) {
        const link = document.querySelector(`[data-menu="${menu}"]`);
        if (link) link.click();
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sidebarManager = new SidebarManager();
    });
} else {
    window.sidebarManager = new SidebarManager();
}