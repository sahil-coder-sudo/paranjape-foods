import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const navItems = [
  {
    href: '/',
    label: 'Home',
    desc: 'Highlights & fresh meals',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/menu',
    label: 'Explore Menu',
    desc: 'Dishes with pure veg & language search',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    href: '/checkout',
    label: 'Order Online',
    desc: 'Cart items, delivery & Razorpay',
    isOrder: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    href: '/track',
    label: 'Track Order',
    desc: 'Live Amazon-style order milestone updates',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    href: '/manager',
    label: 'Kitchen & Manager Portal',
    desc: 'Live order board & milestone dispatch',
    isStaff: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    href: '/delivery',
    label: 'Delivery Partner App',
    desc: 'Pick up orders & mark delivered',
    isStaff: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M15 6h-5a2 2 0 0 0-2 2v6" />
        <path d="M9 17h6" />
        <path d="M19 17v-4l-3-3h-3" />
      </svg>
    ),
  },
  {
    href: '/about',
    label: 'About Us',
    desc: 'Our kitchen story & farm sourcing',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  {
    href: '/contact',
    label: 'Contact',
    desc: 'Address, phone, hours & inquiries',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const router = useRouter();

  // Read cart count from localStorage
  const readCartCount = () => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const count = parsed.reduce((sum, item) => sum + (item.quantity || 1), 0);
          setCartCount(count);
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    setCartCount(0);
  };

  useEffect(() => {
    readCartCount();
    window.addEventListener('storage', readCartCount);
    window.addEventListener('focus', readCartCount);
    return () => {
      window.removeEventListener('storage', readCartCount);
      window.removeEventListener('focus', readCartCount);
    };
  }, []);

  // Refresh cart count whenever drawer opens
  useEffect(() => {
    if (open) {
      readCartCount();
    }
  }, [open]);

  // Close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const navigate = (href) => {
    setOpen(false);
    if (router.pathname === href) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      router.push(href);
    }
  };

  const handleBrandClick = () => {
    setOpen(false);
    if (router.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      router.push('/');
    }
  };

  return (
    <>
      <header>
        {/* Clickable Header Brand - Returns to Home */}
        <button
          type="button"
          className="brand brand-clickable"
          onClick={handleBrandClick}
          aria-label="Paranjape Foods - Return to Home"
          title="Paranjape Foods - Return to Home"
        >
          Paranjape <span>Foods</span>
        </button>

        <div className="header-right-actions">
          {/* Quick Cart Shortcut (when items are in cart) */}
          {cartCount > 0 && (
            <button
              type="button"
              className="header-cart-btn"
              onClick={() => navigate('/checkout')}
              aria-label={`View Cart (${cartCount} items)`}
              title="Proceed to Checkout"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="header-cart-badge">{cartCount}</span>
            </button>
          )}

          {/* Sidebar Trigger (Hamburger Menu Button) */}
          <button
            type="button"
            className={`menu-button ${open ? 'active' : ''}`}
            aria-label={open ? 'Close sidebar shortcuts' : 'Open sidebar shortcuts'}
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            title="Open shortcuts sidebar"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* Dimmed Overlay */}
      <div
        className={`nav-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      {/* Shortcut Sidebar Drawer */}
      <aside className={`nav-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-header">
          {/* Clickable Brand in Sidebar - Returns to Home */}
          <button
            type="button"
            className="brand brand-clickable"
            onClick={handleBrandClick}
            aria-label="Paranjape Foods - Return to Home"
            title="Paranjape Foods - Return to Home"
          >
            Paranjape <span>Foods</span>
          </button>
          <button
            type="button"
            className="close-button"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            ✕
          </button>
        </div>

        <div className="drawer-subhead">
          <span className="drawer-subhead-pill">All Pages &amp; Shortcuts</span>
        </div>

        {/* List of All Pages as Shortcuts */}
        <nav className="drawer-links" aria-label="Page shortcuts">
          {navItems.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <button
                key={item.href}
                type="button"
                className={`drawer-shortcut-card ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.href)}
              >
                <div className="shortcut-icon-box">
                  {item.icon}
                </div>
                <div className="shortcut-text-box">
                  <div className="shortcut-title-row">
                    <span className="shortcut-title">{item.label}</span>
                    {isActive && <span className="active-dot-badge">Active</span>}
                    {item.isOrder && cartCount > 0 && (
                      <span className="shortcut-cart-badge">{cartCount} in cart</span>
                    )}
                  </div>
                  <span className="shortcut-desc">{item.desc}</span>
                </div>
                <div className="shortcut-arrow-col">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Drawer Footer Call to Action */}
        <div className="drawer-footer-card">
          <div className="drawer-footer-title">Paranjape Foods</div>
          <div className="drawer-footer-text">
            Fresh meals delivered daily. Handcrafted comfort food.
          </div>
          <button
            type="button"
            className="drawer-quick-order-btn"
            onClick={() => navigate('/checkout')}
          >
            <span>Order Food Now</span>
            <span>→</span>
          </button>
        </div>
      </aside>
    </>
  );
}
