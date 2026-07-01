import { useState } from 'react';
import { useRouter } from 'next/router';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/menu', label: 'Menu' },
  { href: '/contact', label: 'Contact' },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const navigate = (href) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <header>
        <div className="brand">Paranjape <span>Foods</span></div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <button key={item.href} type="button" className="nav-link" onClick={() => navigate(item.href)}>
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="menu-button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <div
        className={`nav-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside className={`nav-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-header">
          <div className="brand">Sunrise <span>Bistro</span></div>
          <button type="button" className="close-button" onClick={() => setOpen(false)} aria-label="Close menu">
            ×
          </button>
        </div>
        <nav className="drawer-links">
          {navItems.map((item) => (
            <button key={item.href} type="button" className="drawer-link" onClick={() => navigate(item.href)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
