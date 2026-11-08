import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';
import MenuSearchBar from '../components/MenuSearchBar';
import ZomatoDishCard from '../components/ZomatoDishCard';
import { MENU_ITEMS, CATEGORIES } from '../data/menuData';

export default function Menu() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState(MENU_ITEMS);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

  // Load cart from localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) setCart(JSON.parse(savedCart));
    } catch (e) {
      console.error('Error loading cart:', e);
    }

    // Try fetching menu from API (and merge with rich media & tag metadata)
    const fetchMenu = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/menu`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Merge database items with rich local metadata (images, tags, ratings)
            const merged = data.map((dbItem) => {
              const enriched = MENU_ITEMS.find(
                (m) => m.title.toLowerCase() === dbItem.title.toLowerCase()
              );
              return {
                ...enriched,
                ...dbItem,
                _id: dbItem._id || enriched?._id,
                price: typeof dbItem.price === 'number'
                  ? dbItem.price
                  : Number(String(dbItem.price).replace(/[^0-9.]/g, '')) || enriched?.price || 10,
                isVeg: enriched ? enriched.isVeg : true,
                rating: enriched?.rating || 4.7,
                reviews: enriched?.reviews || 95,
                isBestseller: enriched?.isBestseller || false,
                image: enriched?.image || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=400&q=80',
                tags: enriched?.tags || [dbItem.title.toLowerCase(), dbItem.category?.toLowerCase() || ''],
              };
            });
            setMenuItems(merged);
          }
        }
      } catch (err) {
        console.warn('Backend menu fetch deferred, using rich catalog data:', err);
      }
    };

    fetchMenu();
  }, [API_BASE]);

  // Multilingual Search & Filter Algorithm (English, Hindi, Marathi)
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return menuItems.filter((item) => {
      // 1. Category Tab Filter
      if (activeCategory !== 'All' && item.category !== activeCategory) {
        return false;
      }

      // 2. If no search query, item matches
      if (!query) {
        return true;
      }

      // 3. English Match: Title, Description, and Category
      if (item.title.toLowerCase().includes(query)) return true;
      if (item.description && item.description.toLowerCase().includes(query)) return true;
      if (item.category && item.category.toLowerCase().includes(query)) return true;

      // 4. Multilingual Match: Hindi (हिंदी / Hinglish) & Marathi (मराठी / Maranglish)
      if (Array.isArray(item.tags)) {
        const matchesTag = item.tags.some((tag) =>
          tag.toLowerCase().includes(query)
        );
        if (matchesTag) return true;
      }

      return false;
    });
  }, [menuItems, searchQuery, activeCategory]);

  // Group filtered items by category for clear section rendering
  const groupedCategories = useMemo(() => {
    const map = {};
    filteredItems.forEach((item) => {
      const cat = item.category || 'Specialties';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [filteredItems]);

  // Dynamic item counts per category
  const categoryCounts = useMemo(() => {
    const counts = { All: 0 };
    CATEGORIES.forEach((c) => {
      if (c !== 'All') counts[c] = 0;
    });

    menuItems.forEach((item) => {
      counts.All++;
      if (counts[item.category] !== undefined) {
        counts[item.category]++;
      }
    });

    return counts;
  }, [menuItems]);

  // Collapsible category sections
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const toggleCategoryCollapse = (categoryName) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName],
    }));
  };

  const areAllCollapsed =
    Object.keys(groupedCategories).length > 0 &&
    Object.keys(groupedCategories).every((cat) => collapsedCategories[cat]);

  const toggleAllCategories = () => {
    const nextState = !areAllCollapsed;
    const updated = {};
    Object.keys(groupedCategories).forEach((cat) => {
      updated[cat] = nextState;
    });
    setCollapsedCategories(updated);
  };

  // Handle Cart Updates
  const handleUpdateQuantity = (item, delta) => {
    const numericPrice =
      typeof item.price === 'number'
        ? item.price
        : Number(String(item.price).replace(/[^0-9.]/g, '')) || 0;

    const existingIndex = cart.findIndex((c) => c.menuItemId === item._id);
    let updatedCart;

    if (existingIndex > -1) {
      const newQty = cart[existingIndex].quantity + delta;
      if (newQty <= 0) {
        updatedCart = cart.filter((c) => c.menuItemId !== item._id);
      } else {
        updatedCart = cart.map((c) =>
          c.menuItemId === item._id
            ? { ...c, quantity: newQty, price: numericPrice }
            : c
        );
      }
    } else if (delta > 0) {
      updatedCart = [
        ...cart,
        {
          menuItemId: item._id,
          quantity: 1,
          price: numericPrice,
          title: item.title,
        },
      ];
    } else {
      return;
    }

    setCart(updatedCart);
    try {
      localStorage.setItem('cart', JSON.stringify(updatedCart));
    } catch (e) {
      console.error('Error saving cart:', e);
    }
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartAmount = cart.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
    0
  );

  return (
    <>
      <Head>
        <title>Menu - Order Online | Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta
          name="description"
          content="Order fresh food from Paranjape Foods. Search menu in English, हिंदी, and मराठी."
        />
      </Head>

      <main className="page zomato-menu-page">
        <NavBar />

        {/* Hero Headline */}
        <section className="menu-hero-header">
          <div className="eyebrow">Handmade Fresh Daily</div>
          <h1>Explore Our Menu</h1>
          <p className="menu-subheading">
            Order fresh breakfasts, festival specials and sweets.
          </p>
        </section>

        {/* Zomato-Inspired Sticky Search & Category Bar */}
        <MenuSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={activeCategory}
          onCategorySelect={setActiveCategory}
          categories={CATEGORIES}
          categoryCounts={categoryCounts}
        />

        {/* Active Search & Filter Indicator */}
        {(searchQuery || activeCategory !== 'All') && (
          <div className="active-filter-status-row">
            <span>
              Showing {filteredItems.length} {filteredItems.length === 1 ? 'dish' : 'dishes'}
              {searchQuery && (
                <>
                  {' '}for &ldquo;<strong>{searchQuery}</strong>&rdquo;
                </>
              )}
              {activeCategory !== 'All' && ` • ${activeCategory}`}
            </span>
            <button
              type="button"
              className="reset-filters-btn"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
              }}
            >
              Reset all
            </button>
          </div>
        )}

        {/* Menu Items List by Category */}
        <section className="zomato-menu-content">
          {Object.keys(groupedCategories).length > 0 ? (
            <>
              {Object.keys(groupedCategories).length > 1 && (
                <div className="zomato-collapse-controls-row">
                  <span className="zomato-menu-count-hint">
                    {Object.keys(groupedCategories).length} sections available
                  </span>
                  <button
                    type="button"
                    className="toggle-all-button"
                    onClick={toggleAllCategories}
                  >
                    {areAllCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                  </button>
                </div>
              )}

              {Object.keys(groupedCategories).map((categoryName) => {
                const categoryItems = groupedCategories[categoryName];
                const isCollapsed = !!collapsedCategories[categoryName];
                return (
                  <div key={categoryName} className="zomato-category-section">
                    <button
                      type="button"
                      className="zomato-section-heading"
                      onClick={() => toggleCategoryCollapse(categoryName)}
                      aria-expanded={!isCollapsed}
                    >
                      <div className="zomato-heading-title-group">
                        <h2>{categoryName}</h2>
                        <span className="section-item-count">
                          {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <span className={`section-chevron-icon ${isCollapsed ? 'collapsed' : 'expanded'}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div className="zomato-dish-list">
                        {categoryItems.map((item) => {
                          const inCartItem = cart.find((c) => c.menuItemId === item._id);
                          const currentQty = inCartItem ? inCartItem.quantity : 0;
                          return (
                            <ZomatoDishCard
                              key={item._id}
                              item={item}
                              currentQty={currentQty}
                              onUpdateQuantity={handleUpdateQuantity}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            /* Empty State when Search has no matches */
            <div className="zomato-empty-state">
              <div className="empty-state-icon">🍽️</div>
              <h3>No dishes found</h3>
              <p>
                We couldn&rsquo;t find any items matching &ldquo;<strong>{searchQuery}</strong>&rdquo;.
              </p>
              <div className="multilingual-search-suggestions">
                <span className="suggestion-label">Try searching:</span>
                <div className="suggestion-tags">
                  <button type="button" onClick={() => setSearchQuery('टोस्ट')}>टोस्ट (Toast)</button>
                  <button type="button" onClick={() => setSearchQuery('पैनकेक')}>पैनकेक (Pancakes)</button>
                  <button type="button" onClick={() => setSearchQuery('सँडविच')}>सँडविच (Sandwich)</button>
                  <button type="button" onClick={() => setSearchQuery('कोशिंबीर')}>कोशिंबीर (Salad)</button>
                  <button type="button" onClick={() => setSearchQuery('गोड')}>गोड (Dessert)</button>
                </div>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
              >
                Clear Filters &amp; View Full Menu
              </button>
            </div>
          )}
        </section>

        {/* Zomato Floating Sticky Cart Dock */}
        {totalCartCount > 0 && (
          <aside className="zomato-floating-cart-bar" aria-label="Cart Summary">
            <div className="cart-dock-info">
              <div className="cart-dock-count-badge">
                {totalCartCount}
              </div>
              <div className="cart-dock-text">
                <span className="cart-dock-title">
                  {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'} in cart
                </span>
                <span className="cart-dock-amount">Total: ₹{totalCartAmount}</span>
              </div>
            </div>

            <button
              type="button"
              className="cart-dock-cta-btn"
              onClick={() => router.push('/checkout')}
            >
              <span>View Cart</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </aside>
        )}

        <footer className="footer menu-footer">
          <p>Fresh ingredients, handcrafted recipes & fast neighborhood delivery.</p>
        </footer>
      </main>
    </>
  );
}
