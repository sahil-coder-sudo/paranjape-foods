import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';
import MenuSearchBar from '../components/MenuSearchBar';
import ZomatoDishCard from '../components/ZomatoDishCard';
import DeliveryMapPicker from '../components/DeliveryMapPicker';
import { MENU_ITEMS, CATEGORIES } from '../data/menuData';

export default function Checkout() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState([]);
  const [menuItems, setMenuItems] = useState(MENU_ITEMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [customer, setCustomer] = useState(null);
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    email: '',
  });
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [newAddress, setNewAddress] = useState({
    flatNo: '',
    buildingName: '',
    street: '',
    city: 'Pune',
    state: 'Maharashtra',
    zipCode: '',
    latitude: 18.5204,
    longitude: 73.8567,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' or 'razorpay'
  const [placedOrder, setPlacedOrder] = useState(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('cart');
    if (savedCart) setCart(JSON.parse(savedCart));

    // Load menu
    fetchMenu();

    // Load customer from localStorage
    const savedCustomer = localStorage.getItem('customer');
    if (savedCustomer) {
      try {
        const parsed = JSON.parse(savedCustomer);
        if (parsed && parsed._id && !parsed.error) {
          setCustomer(parsed);
          setFormData({
            phone: parsed.phone || '',
            name: parsed.name || '',
            email: parsed.email || '',
          });
          fetchAddresses(parsed._id);
        } else {
          localStorage.removeItem('customer');
        }
      } catch (e) {
        localStorage.removeItem('customer');
      }
    }
  }, []);

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
              price:
                typeof dbItem.price === 'number'
                  ? dbItem.price
                  : Number(String(dbItem.price).replace(/[^0-9.]/g, '')) || enriched?.price || 10,
              isVeg: enriched ? enriched.isVeg : true,
              rating: enriched?.rating || 4.7,
              reviews: enriched?.reviews || 95,
              isBestseller: enriched?.isBestseller || false,
              image:
                enriched?.image ||
                'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=400&q=80',
              tags: enriched?.tags || [dbItem.title.toLowerCase(), dbItem.category?.toLowerCase() || ''],
            };
          });
          setMenuItems(merged);
        } else {
          setMenuItems(MENU_ITEMS);
        }
      } else {
        setMenuItems(MENU_ITEMS);
      }
    } catch (err) {
      console.warn('Menu fetch failed, using rich catalog data:', err);
      setMenuItems(MENU_ITEMS);
    }
  };

  // Multilingual Search & Filter Algorithm (English, Hindi, Marathi)
  const filteredMenuItems = useMemo(() => {
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
    filteredMenuItems.forEach((item) => {
      const cat = item.category || 'Specialties';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [filteredMenuItems]);

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

  const updateQuantity = (item, delta) => {
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
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  const fetchAddresses = async (customerId) => {
    try {
      const res = await fetch(`${API_BASE}/api/addresses/${customerId}`);
      const data = await res.json();
      setAddresses(data);
      if (data.length > 0) setSelectedAddress(data[0]._id);
    } catch (err) {
      console.error('Failed to fetch addresses', err);
    }
  };

  const handlePhoneBlur = async (e) => {
    const raw = e.target.value;
    const clean = raw.replace(/\D/g, '').trim();
    if (clean.length === 10) {
      try {
        const res = await fetch(`${API_BASE}/api/customer/phone/${clean}`);
        if (res.ok) {
          const existing = await res.json();
          if (existing && existing.phone) {
            setFormData((prev) => ({
              ...prev,
              phone: existing.phone,
              name: existing.name || prev.name,
              email: existing.email || prev.email,
            }));
          }
        }
      } catch (err) {
        // Ignore lookup error
      }
    }
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    const phone = formData.phone;
    const name = formData.name;
    const email = formData.email;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, email }),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data._id) {
        setError(data.error || 'Failed to process details. Please try again.');
        return;
      }
      setError('');
      setCustomer(data);
      localStorage.setItem('customer', JSON.stringify(data));
      fetchAddresses(data._id);
      setStep(2);
    } catch (err) {
      setError('Failed to create/fetch customer');
    } finally {
      setLoading(false);
    }
  };

  const handleMapAddressSelect = (addr) => {
    setError('');
    setNewAddress((prev) => ({
      ...prev,
      buildingName: addr.buildingName || prev.buildingName,
      street: addr.street || prev.street,
      city: addr.city || prev.city,
      state: addr.state || prev.state,
      zipCode: addr.zipCode || prev.zipCode,
      latitude: addr.latitude || prev.latitude,
      longitude: addr.longitude || prev.longitude,
    }));
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!customer || !customer._id) {
      setError('Please provide your customer details first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/address/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer._id,
          ...newAddress,
        }),
      });
      const data = await res.json();
      if (res.ok && data && data._id) {
        setAddresses((prev) => [...prev, data]);
        setSelectedAddress(data._id);
        setNewAddress({
          flatNo: '',
          buildingName: '',
          street: '',
          city: 'Pune',
          state: 'Maharashtra',
          zipCode: '',
          latitude: 18.5204,
          longitude: 73.8567,
        });
      } else {
        setError(data.error || 'Failed to save address');
      }
    } catch (err) {
      setError('Failed to add address');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const priceNum =
        typeof item.price === 'number'
          ? item.price
          : Number(String(item.price).replace(/[^0-9.]/g, '')) || 0;
      return sum + priceNum * item.quantity;
    }, 0);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setError('Please select an address');
      return;
    }

    if (cart.length === 0) {
      setError('Your cart is empty. Please select dishes before placing an order.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/order/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer._id,
          items: cart,
          totalAmount: calculateTotal(),
          addressId: selectedAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to create order. Please try again.');
        return;
      }

      // Check if Razorpay payment was selected and order initialized
      if (paymentMethod === 'razorpay' && data.razorpayOrderId) {
        initiateRazorpayPayment(data);
      } else {
        // Direct confirmation for Pay on Delivery / Simulated gateway
        const selectedAddrObj = addresses.find((a) => a._id === selectedAddress) || newAddress;
        setPlacedOrder({
          orderId: data.orderId,
          totalAmount: data.amount || calculateTotal(),
          items: [...cart],
          paymentMethod: data.paymentMethod || 'cod',
          address: selectedAddrObj,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem('lastOrderId', data.orderId);
        localStorage.removeItem('cart');
        setCart([]);
        setStep(5);
      }
    } catch (err) {
      setError('Failed to place order: ' + (err.message || 'Please check connection'));
    } finally {
      setLoading(false);
    }
  };

  const initiateRazorpayPayment = (orderData) => {
    const selectedAddrObj = addresses.find((a) => a._id === selectedAddress) || newAddress;

    if (typeof window === 'undefined' || !window.Razorpay) {
      // If Razorpay SDK didn't load, smoothly fall back to Pay on Delivery
      setPlacedOrder({
        orderId: orderData.orderId,
        totalAmount: orderData.amount || calculateTotal(),
        items: [...cart],
        paymentMethod: 'cod',
        address: selectedAddrObj,
        createdAt: new Date().toISOString(),
      });
      localStorage.removeItem('cart');
      setCart([]);
      setStep(5);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      amount: Math.round(Number(orderData.amount) * 100),
      currency: 'INR',
      name: 'Paranjape Foods',
      description: `Order #${String(orderData.orderId).slice(-6).toUpperCase()}`,
      order_id: orderData.razorpayOrderId,
      handler: async (response) => {
        try {
          const res = await fetch(`${API_BASE}/api/payment/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderData.orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setPlacedOrder({
              orderId: orderData.orderId,
              totalAmount: orderData.amount,
              items: [...cart],
              paymentMethod: 'razorpay',
              paymentId: response.razorpay_payment_id,
              address: selectedAddrObj,
              createdAt: new Date().toISOString(),
            });
            localStorage.removeItem('cart');
            setCart([]);
            setStep(5);
          } else {
            setError(data.error || 'Payment verification failed');
          }
        } catch (err) {
          setError('Failed to verify payment');
        }
      },
      prefill: {
        name: customer?.name || '',
        email: customer?.email || '',
        contact: customer?.phone || '',
      },
      theme: {
        color: '#c94f2f',
      },
      modal: {
        ondismiss: function () {
          setLoading(false);
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setError(`Payment failed: ${response.error?.description || 'Transaction was declined'}`);
        setLoading(false);
      });
      rzp.open();
    } catch (rzpErr) {
      // In case key is invalid, inform user they can pay on delivery
      setError('Could not open Razorpay window. Please switch to Pay on Delivery to complete your order.');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Checkout - Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </Head>

      <main className="page">
        <NavBar />

        <section className="checkout-container">
          {/* Step 1: Customer Info */}
          {step === 1 && (
            <div className="checkout-step">
              <div className="checkout-step-nav">
                <button
                  type="button"
                  className="step-back-link"
                  onClick={() => router.push('/menu')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Back to Menu</span>
                </button>
                <span className="step-badge-indicator">Step 1 of 4</span>
              </div>

              <h2>Step 1: Your Details</h2>
              <form onSubmit={handleCustomerSubmit}>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={handlePhoneBlur}
                    placeholder="10 digit mobile number"
                  />
                </div>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
                <div className="form-group">
                  <label>Email (Optional)</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="checkout-footer-buttons">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => router.push('/menu')}
                  >
                    ← Back to Menu
                  </button>
                  <button type="submit" disabled={loading} className="button">
                    {loading ? 'Loading...' : 'Continue to Menu →'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: Menu Selection */}
          {step === 2 && customer && (
            <div className={`checkout-step ${cart.length > 0 ? 'has-floating-cart' : ''}`}>
              <div className="checkout-step-nav">
                <button
                  type="button"
                  className="step-back-link"
                  onClick={() => setStep(1)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Back to Details</span>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      className="step-quick-proceed-btn"
                      onClick={() => setStep(3)}
                    >
                      Proceed to Address (₹{calculateTotal()}) →
                    </button>
                  )}
                  <span className="step-badge-indicator">Step 2 of 4</span>
                </div>
              </div>

              <div className="section-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h2>Step 2: Select Items</h2>
                  <p className="checkout-step-subtitle">
                    Select your favorite items from our handcrafted daily menu.
                  </p>
                </div>
                {Object.keys(groupedCategories).length > 1 && (
                  <button
                    type="button"
                    className="toggle-all-button"
                    onClick={toggleAllCategories}
                  >
                    {areAllCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                  </button>
                )}
              </div>

              {/* Zomato-Inspired Search & Category Bar */}
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
                <div className="active-filter-status-row" style={{ marginTop: '8px', marginBottom: '14px' }}>
                  <span>
                    Showing {filteredMenuItems.length} {filteredMenuItems.length === 1 ? 'dish' : 'dishes'}
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

              {/* Zomato Dish Cards by Category */}
              <div className="zomato-menu-content" style={{ marginTop: '14px', marginBottom: '24px' }}>
                {Object.keys(groupedCategories).length > 0 ? (
                  Object.keys(groupedCategories).map((categoryName) => {
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
                                  onUpdateQuantity={updateQuantity}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
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
                        <button type="button" onClick={() => setSearchQuery('सैंडविच')}>सैंडविच (Sandwich)</button>
                        <button type="button" onClick={() => setSearchQuery('सॅलड')}>सॅलड (Salad)</button>
                        <button type="button" onClick={() => setSearchQuery('गोड')}>गोड (Sweet)</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating Bottom Proceed Dock for Step 2 */}
              {cart.length > 0 && (
                <aside className="zomato-floating-cart-bar" aria-label="Cart Summary">
                  <div className="cart-dock-info">
                    <div className="cart-dock-count-badge">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </div>
                    <div className="cart-dock-text">
                      <span className="cart-dock-title">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                        {cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'} in cart
                      </span>
                      <span className="cart-dock-amount">Total: ₹{calculateTotal()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="cart-dock-cta-btn"
                    onClick={() => setStep(3)}
                    aria-label="Proceed to Delivery Address"
                  >
                    <span>Proceed to Address</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </aside>
              )}

              <div className="checkout-footer">
                <p>Total: ₹{calculateTotal()}</p>
                <div className="checkout-footer-buttons">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setStep(1)}
                  >
                    ← Back to Details
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={cart.length === 0}
                    className="button"
                  >
                    Proceed to Address →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Address Selection */}
          {step === 3 && customer && (
            <div className="checkout-step">
              <div className="checkout-step-nav">
                <button
                  type="button"
                  className="step-back-link"
                  onClick={() => setStep(2)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Back to Menu Selection</span>
                </button>
                <span className="step-badge-indicator">Step 3 of 4</span>
              </div>

              <h2>Step 3: Delivery Address</h2>

              {addresses.length > 0 && (
                <div className="addresses-list">
                  <h3>Saved Delivery Addresses</h3>
                  {addresses.map((addr) => (
                    <div
                      key={addr._id}
                      className={`address-card ${selectedAddress === addr._id ? 'selected' : ''}`}
                      onClick={() => setSelectedAddress(addr._id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="address-card-radio" />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {addr.flatNo ? `${addr.flatNo}, ` : ''}{addr.buildingName ? `${addr.buildingName}, ` : ''}{addr.street}
                        </p>
                        <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginTop: '2px' }}>
                          {addr.city}, {addr.state} {addr.zipCode}
                        </p>
                      </div>
                      {selectedAddress === addr._id && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', background: 'rgba(201, 79, 47, 0.1)', padding: '3px 8px', borderRadius: '8px' }}>
                          Selected
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="new-address-form">
                <h3>{addresses.length > 0 ? 'Or Add New Address' : 'Add Delivery Address'}</h3>

                {/* Google Maps Delivery Location Picker & Search */}
                <DeliveryMapPicker
                  apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                  onAddressSelect={handleMapAddressSelect}
                  currentAddress={newAddress}
                />

                <form onSubmit={handleAddAddress}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>Flat / House / Door No.</label>
                      <input
                        type="text"
                        value={newAddress.flatNo}
                        onChange={(e) => setNewAddress({ ...newAddress, flatNo: e.target.value })}
                        placeholder="e.g. Flat 402, B-Wing"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Building / Society Name</label>
                      <input
                        type="text"
                        value={newAddress.buildingName}
                        onChange={(e) => setNewAddress({ ...newAddress, buildingName: e.target.value })}
                        placeholder="e.g. Sunshine Apartments"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Street / Area / Landmark</label>
                    <input
                      type="text"
                      value={newAddress.street}
                      onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                      placeholder="e.g. Near Goodluck Cafe, FC Road"
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        placeholder="City"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <input
                        type="text"
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                        placeholder="State"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Postal Code / Pincode</label>
                    <input
                      type="text"
                      value={newAddress.zipCode}
                      onChange={(e) => setNewAddress({ ...newAddress, zipCode: e.target.value })}
                      placeholder="e.g. 411004"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="button-secondary" style={{ width: '100%', padding: '12px', justifyContent: 'center' }}>
                    {loading ? 'Saving Address...' : '+ Save Delivery Address'}
                  </button>
                </form>
              </div>

              <div className="checkout-footer">
                <div className="checkout-footer-buttons">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => setStep(2)}
                  >
                    ← Back to Menu
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    disabled={!selectedAddress}
                    className="button"
                  >
                    Proceed to Payment →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && customer && (
            <div className="checkout-step">
              <div className="checkout-step-nav">
                <button
                  type="button"
                  className="step-back-link"
                  onClick={() => setStep(3)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Back to Address</span>
                </button>
                <span className="step-badge-indicator">Step 4 of 4</span>
              </div>

              <h2>Step 4: Review & Payment</h2>

              {/* Delivery Destination Recap */}
              {(() => {
                const currentSelectedAddr =
                  addresses.find((a) => a._id === selectedAddress) ||
                  (newAddress.street ? newAddress : null);
                if (!currentSelectedAddr) return null;
                return (
                  <div className="step-address-recap">
                    <div className="step-address-info">
                      <h4>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Delivering to
                      </h4>
                      <p>
                        {currentSelectedAddr.flatNo ? `${currentSelectedAddr.flatNo}, ` : ''}
                        {currentSelectedAddr.buildingName ? `${currentSelectedAddr.buildingName}, ` : ''}
                        {currentSelectedAddr.street}, {currentSelectedAddr.city}{' '}
                        {currentSelectedAddr.zipCode ? `- ${currentSelectedAddr.zipCode}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="step-change-btn"
                      onClick={() => setStep(3)}
                    >
                      Change
                    </button>
                  </div>
                );
              })()}

              <div className="order-summary">
                <h3>Order Summary</h3>
                {cart.map((item) => {
                  const menuItem = menuItems.find((m) => m._id === item.menuItemId);
                  const title = menuItem?.title || item.title || 'Item';
                  const priceNum =
                    typeof item.price === 'number'
                      ? item.price
                      : Number(String(item.price).replace(/[^0-9.]/g, '')) || 0;
                  return (
                    <div key={item.menuItemId} className="summary-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {menuItem && (
                          <span
                            className={`dietary-symbol ${menuItem.isVeg ? 'veg' : 'non-veg'}`}
                            style={{ width: '13px', height: '13px' }}
                            title={menuItem.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                          >
                            <span className="dietary-inner" style={{ width: '5px', height: '5px' }} />
                          </span>
                        )}
                        <span>{title}</span>
                      </div>
                      <span>
                        ₹{priceNum} x {item.quantity} = ₹{priceNum * item.quantity}
                      </span>
                    </div>
                  );
                })}
                <hr />
                <div className="summary-item" style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                  <span>Delivery Fee</span>
                  <span style={{ color: '#137333', fontWeight: 600 }}>FREE</span>
                </div>
                <div className="summary-total">
                  <strong>To Pay:</strong>
                  <strong style={{ color: 'var(--accent)' }}>₹{calculateTotal()}</strong>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="payment-method-container">
                <h3>Select Payment Method</h3>
                <div className="payment-options-grid">
                  {/* Option 1: Cash / Pay on Delivery */}
                  <div
                    className={`payment-option-card ${paymentMethod === 'cod' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('cod')}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="payment-radio-indicator">
                      <div className="payment-radio-inner" />
                    </div>
                    <div className="payment-option-body">
                      <div className="payment-option-header">
                        <span className="payment-option-title">Pay via Cash / UPI on Delivery</span>
                        <span className="payment-badge-recommended">Active & Available</span>
                      </div>
                      <p className="payment-option-desc">
                        Pay conveniently via Cash, PhonePe, Google Pay, or Paytm directly to the delivery partner when your order arrives.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Razorpay Online (Greyed out for now) */}
                  <div
                    className="payment-option-card disabled"
                    aria-disabled="true"
                    title="Online payment via Razorpay is temporarily unavailable. Please choose Pay on Delivery."
                  >
                    <div className="payment-radio-indicator" style={{ background: '#f5f1ea', borderColor: '#e0d8cb' }}>
                      <div className="payment-radio-inner" />
                    </div>
                    <div className="payment-option-body">
                      <div className="payment-option-header">
                        <span className="payment-option-title" style={{ color: '#8c857b' }}>
                          Online Payment (Razorpay)
                        </span>
                        <span className="payment-badge-disabled">Temporarily Unavailable</span>
                      </div>
                      <p className="payment-option-desc">
                        Credit/Debit Cards, NetBanking & Razorpay online gateway will be enabled soon. Please use Cash or UPI on delivery.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="checkout-footer-buttons">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setStep(3)}
                >
                  ← Back to Address
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="button"
                >
                  {loading
                    ? 'Placing Order...'
                    : `Place Order (Pay ₹${calculateTotal()} on Delivery)`}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Order Placed & Confirmed */}
          {step === 5 && (
            <div className="checkout-step order-confirmation-screen">
              <div className="order-success-icon-wrapper">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h2>Order Confirmed!</h2>
              <p className="order-subtitle">
                Thank you, {customer?.name || 'Foodie'}! Your order has been placed and sent to our kitchen.
              </p>

              <div className="order-details-card">
                <div className="order-details-header">
                  <div>
                    <div className="order-id-label">Order Reference</div>
                    <div className="order-id-value">
                      #PF-{placedOrder?.orderId ? String(placedOrder.orderId).slice(-6).toUpperCase() : 'CONFIRMED'}
                    </div>
                  </div>
                  <div className="order-status-badge">
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#137333', display: 'inline-block' }} />
                    In Kitchen
                  </div>
                </div>

                <div className="order-info-section">
                  <div className="order-info-row">
                    <span className="label">Estimated Delivery:</span>
                    <span className="value" style={{ color: 'var(--accent)' }}>30 - 45 Minutes</span>
                  </div>
                  <div className="order-info-row">
                    <span className="label">Delivery Address:</span>
                    <span className="value">
                      {placedOrder?.address
                        ? `${placedOrder.address.flatNo ? placedOrder.address.flatNo + ', ' : ''}${placedOrder.address.buildingName ? placedOrder.address.buildingName + ', ' : ''}${placedOrder.address.street || ''}, ${placedOrder.address.city || ''}`
                        : 'Your Pune Address'}
                    </span>
                  </div>
                  <div className="order-info-row">
                    <span className="label">Contact Phone:</span>
                    <span className="value">{customer?.phone || '-'}</span>
                  </div>
                  <div className="order-info-row">
                    <span className="label">Payment Mode:</span>
                    <span className="value">
                      {placedOrder?.paymentMethod === 'razorpay'
                        ? 'Paid Online (Razorpay)'
                        : 'Pay on Delivery (Cash / UPI)'}
                    </span>
                  </div>
                </div>

                {placedOrder?.items && placedOrder.items.length > 0 && (
                  <div className="order-items-recap">
                    <h4>Dishes Ordered</h4>
                    {placedOrder.items.map((item, idx) => {
                      const mItem = menuItems.find((m) => m._id === item.menuItemId);
                      const title = mItem?.title || item.title || `Item #${idx + 1}`;
                      const priceNum = Number(item.price) || 0;
                      return (
                        <div key={idx} className="order-item-recap-row">
                          <span>{title} × {item.quantity}</span>
                          <span>₹{priceNum * item.quantity}</span>
                        </div>
                      );
                    })}
                    <div className="order-total-recap-row">
                      <span>Total Amount:</span>
                      <span style={{ color: 'var(--accent)' }}>₹{placedOrder.totalAmount}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="order-confirmation-actions">
                <button
                  type="button"
                  onClick={() => router.push(`/track?orderId=${placedOrder?.orderId}`)}
                  className="button"
                  style={{ width: '100%', background: '#137333', borderColor: '#137333', justifyContent: 'center' }}
                >
                  🚀 Track Live Milestone Updates (Amazon-Style) →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                  }}
                  className="button-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Order More Dishes
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="button-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Return to Home
                </button>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </section>
      </main>
    </>
  );
}
