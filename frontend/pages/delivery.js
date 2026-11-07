import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

// Strips flat/room numbers to keep ONLY building name, street & city for accurate Google Maps turn-by-turn navigation
function getBuildingNavigationQuery(addr) {
  if (!addr) return 'Pune, Maharashtra';

  // 1. If buildingName is explicitly present, compose: buildingName + street + city
  if (addr.buildingName) {
    const parts = [
      addr.buildingName,
      addr.street && addr.street !== addr.buildingName ? addr.street : null,
      addr.city || 'Pune',
      addr.zipCode || '',
    ].filter(Boolean);
    return parts.join(', ');
  }

  // 2. Legacy fallback: strip out flat/apartment/room prefix from street
  let raw = String(addr.street || '');
  let cleaned = raw
    .replace(/^(flat|apt|apartment|room|house|door|unit|block|bldg)?\s*no\.?\s*[a-z0-9\/-]+\s*,?\s*/i, '')
    .replace(/^#?\s*[a-z0-9]{1,4}[-\/][a-z0-9]{1,4}\s*,?\s*/i, '')
    .replace(/^#?\s*\d{1,4}[a-z]?\s*,?\s*/i, '')
    .trim();

  const parts = [cleaned || raw, addr.city || 'Pune', addr.zipCode || ''].filter(Boolean);
  return parts.join(', ');
}

export default function DeliveryPortal() {
  const router = useRouter();

  // Authentication State
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Delivery Orders State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active', 'ready', 'out_for_delivery', 'delivered'
  const [toastMessage, setToastMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const eventSourceRef = useRef(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  // 1. Play audio chime on new ready-to-deliver order
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch (e) {
      // Audio context might be restricted
    }
  };

  // 2. Check existing session on mount
  useEffect(() => {
    const savedToken =
      (typeof window !== 'undefined' &&
        (localStorage.getItem('pf_delivery_token') || sessionStorage.getItem('pf_delivery_token'))) ||
      null;

    if (!savedToken) {
      setAuthChecking(false);
      return;
    }

    fetch(`${API_BASE}/api/delivery/auth/check`, {
      headers: { 'x-delivery-token': savedToken },
    })
      .then((res) => {
        if (res.ok) {
          setToken(savedToken);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('pf_delivery_token');
          sessionStorage.removeItem('pf_delivery_token');
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  // 3. Fetch Delivery Orders
  const fetchDeliveryOrders = async (currentToken = token) => {
    if (!currentToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/delivery/orders`, {
        headers: { 'x-delivery-token': currentToken },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch delivery orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // 4. Connect SSE Stream when Authenticated
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    fetchDeliveryOrders(token);

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        const es = new EventSource(`${API_BASE}/api/admin/orders/stream?token=${encodeURIComponent(token)}`);
        eventSourceRef.current = es;

        es.addEventListener('order_update', (e) => {
          try {
            const updated = JSON.parse(e.data);
            setOrders((prev) => {
              const exists = prev.some((o) => o._id === updated._id);
              if (exists) {
                return prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o));
              } else if (['ready', 'out_for_delivery'].includes(updated.orderStatus)) {
                playChime();
                setToastMessage(`📦 New Order Ready: #PF-${String(updated._id).slice(-6).toUpperCase()}`);
                setTimeout(() => setToastMessage(''), 5000);
                return [updated, ...prev];
              }
              return prev;
            });
          } catch (err) {
            console.error('Error handling order_update event', err);
          }
        });

        es.addEventListener('new_order', () => {
          fetchDeliveryOrders(token);
        });
      } catch (e) {
        console.warn('Delivery SSE stream failed');
      }
    }

    const interval = setInterval(() => {
      fetchDeliveryOrders(token);
    }, 7000);

    return () => {
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isAuthenticated, token]);

  // Handle Login submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setAuthError('Please enter your rider passcode or PIN.');
      return;
    }

    setAuthSubmitting(true);
    setAuthError('');

    try {
      const res = await fetch(`${API_BASE}/api/delivery/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setToken(data.token);
        setIsAuthenticated(true);
        setPasscode('');

        if (rememberMe) {
          localStorage.setItem('pf_delivery_token', data.token);
        } else {
          sessionStorage.setItem('pf_delivery_token', data.token);
        }
      } else {
        setAuthError(data.error || 'Incorrect passcode. Please try again.');
      }
    } catch (err) {
      setAuthError('Unable to authenticate rider. Please check connection.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handle Logout / End Shift
  const handleLogout = () => {
    localStorage.removeItem('pf_delivery_token');
    sessionStorage.removeItem('pf_delivery_token');
    setToken(null);
    setIsAuthenticated(false);
    setOrders([]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  // Action: Mark order Picked Up (Out for Delivery)
  const handleMarkPickedUp = async (orderId) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/api/delivery/order/${orderId}/pickup`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-delivery-token': token,
        },
      });

      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o))
        );
        playChime();
        setToastMessage(`🛵 Order #PF-${orderId.slice(-6).toUpperCase()} marked Picked Up! You are on the way.`);
        setTimeout(() => setToastMessage(''), 5000);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      alert('Failed to mark order picked up. Please check connection.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Action: Mark order Delivered at Destination
  const handleMarkDelivered = async (orderId, totalAmount) => {
    const confirmPrompt =
      `Confirm Delivery for Order #PF-${orderId.slice(-6).toUpperCase()}?\n\n` +
      `💰 MANDATORY PAYMENT CHECK:\n` +
      `Have you collected ₹${totalAmount} from the customer via Cash or UPI QR scan?`;

    if (!window.confirm(confirmPrompt)) return;

    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/api/delivery/order/${orderId}/deliver`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-delivery-token': token,
        },
      });

      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o))
        );
        playChime();
        setToastMessage(`🎉 Order #PF-${orderId.slice(-6).toUpperCase()} delivered and ₹${totalAmount} collected!`);
        setTimeout(() => setToastMessage(''), 5000);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      alert('Failed to mark order delivered.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (filter === 'active') return ['ready', 'out_for_delivery'].includes(o.orderStatus);
    if (filter === 'ready') return o.orderStatus === 'ready';
    if (filter === 'out_for_delivery') return o.orderStatus === 'out_for_delivery';
    if (filter === 'delivered') return o.orderStatus === 'delivered';
    return true;
  });

  const stats = {
    active: orders.filter((o) => ['ready', 'out_for_delivery'].includes(o.orderStatus)).length,
    inTransit: orders.filter((o) => o.orderStatus === 'out_for_delivery').length,
    ready: orders.filter((o) => o.orderStatus === 'ready').length,
    delivered: orders.filter((o) => o.orderStatus === 'delivered').length,
  };

  if (authChecking) {
    return (
      <main className="page" style={{ maxWidth: '520px' }}>
        <NavBar />
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
          <div
            className="live-pulse-dot"
            style={{
              margin: '0 auto 14px',
              width: '12px',
              height: '12px',
              background: '#137333',
            }}
          />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>Connecting rider terminal...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Delivery Partner Portal - Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      {/* =========================================================================
          UNAUTHENTICATED VIEW: Delivery Driver Login Window
         ========================================================================= */}
      {!isAuthenticated ? (
        <main className="page" style={{ maxWidth: '500px' }}>
          <NavBar />

          <div className="manager-auth-wrapper">
            <div className="manager-auth-card">
              <div
                className="manager-lock-icon-circle"
                style={{
                  background: 'linear-gradient(135deg, rgba(19, 115, 51, 0.12) 0%, rgba(19, 115, 51, 0.04) 100%)',
                  color: '#137333',
                  borderColor: 'rgba(19, 115, 51, 0.25)',
                }}
              >
                <span style={{ fontSize: '1.8rem' }}>🛵</span>
              </div>

              <span
                className="manager-auth-badge"
                style={{ background: '#e6f4ea', color: '#137333', borderColor: 'rgba(19, 115, 51, 0.2)' }}
              >
                Delivery Partner App
              </span>
              <h2>Rider Dispatch Portal</h2>
              <p className="manager-auth-desc">
                Enter your rider PIN or passcode to access pickup orders, navigate customer addresses &amp; confirm deliveries.
              </p>

              {authError && (
                <div className="error-message" style={{ margin: '0 0 18px', textAlign: 'left' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                <div className="manager-passcode-field">
                  <label htmlFor="riderPinInput">Rider PIN / Passcode</label>
                  <div className="manager-input-container">
                    <input
                      id="riderPinInput"
                      type={showPasscode ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter rider PIN (e.g. 1234 or rider2026)"
                      required
                      autoFocus
                      className="manager-passcode-input"
                    />
                    <button
                      type="button"
                      className="manager-eye-btn"
                      onClick={() => setShowPasscode((prev) => !prev)}
                      title={showPasscode ? 'Hide passcode' : 'Show passcode'}
                    >
                      {showPasscode ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <label className="manager-auth-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Keep session active on this phone</span>
                </label>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="manager-auth-btn"
                  style={{ background: '#137333', boxShadow: '0 4px 14px rgba(19, 115, 51, 0.28)' }}
                >
                  {authSubmitting ? 'Verifying Rider PIN...' : 'Start Delivery Shift 🛵 →'}
                </button>
              </form>

              <div className="manager-auth-hint-box">
                🛵 Configured in <code>.env.local</code> as <code>DELIVERY_PASSCODE</code> (default: <code>rider2026</code> or quick PIN <code>1234</code>).
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* =========================================================================
            AUTHENTICATED VIEW: Delivery Partner Mobile Dashboard
           ========================================================================= */
        <main className="delivery-container">
          <NavBar />

          {/* Real-time Toast Banner */}
          {toastMessage && (
            <div className="manager-toast-banner" role="alert">
              <span style={{ fontSize: '1.2rem' }}>🛵</span>
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Topbar */}
          <div className="delivery-topbar">
            <div className="delivery-title-area">
              <h1>Rider Dispatch Portal</h1>
              <p>Delivery partner live task board &amp; destination navigator.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="tracker-live-pill">
                <span className="live-pulse-dot" />
                <span>On Duty</span>
              </div>

              <button
                type="button"
                className="manager-refresh-btn"
                onClick={() => setSoundEnabled((prev) => !prev)}
                title="Toggle order chime"
              >
                {soundEnabled ? '🔔' : '🔕'}
              </button>

              <button
                type="button"
                className="manager-refresh-btn"
                onClick={() => fetchDeliveryOrders(token)}
                title="Refresh tasks"
              >
                🔄
              </button>

              <button
                type="button"
                className="manager-signout-btn"
                onClick={handleLogout}
                title="End Shift"
              >
                End Shift
              </button>
            </div>
          </div>

          {/* Top Quick Stats Grid */}
          <div className="manager-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '18px' }}>
            <div
              className={`manager-stat-card ${filter === 'out_for_delivery' ? 'active' : ''}`}
              onClick={() => setFilter('out_for_delivery')}
            >
              <div className="stat-num" style={{ color: 'var(--accent)' }}>{stats.inTransit}</div>
              <div className="stat-label">In Transit</div>
            </div>
            <div
              className={`manager-stat-card ${filter === 'ready' ? 'active' : ''}`}
              onClick={() => setFilter('ready')}
            >
              <div className="stat-num" style={{ color: '#8430cf' }}>{stats.ready}</div>
              <div className="stat-label">Ready at Kitchen</div>
            </div>
            <div
              className={`manager-stat-card ${filter === 'delivered' ? 'active' : ''}`}
              onClick={() => setFilter('delivered')}
            >
              <div className="stat-num" style={{ color: '#137333' }}>{stats.delivered}</div>
              <div className="stat-label">Delivered Today</div>
            </div>
          </div>

          {/* Segmented Filter Bar */}
          <div className="manager-filter-bar" style={{ marginBottom: '18px' }}>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active Tasks <span className="manager-filter-badge">{stats.active}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'out_for_delivery' ? 'active' : ''}`}
              onClick={() => setFilter('out_for_delivery')}
            >
              🛵 In Transit <span className="manager-filter-badge">{stats.inTransit}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'ready' ? 'active' : ''}`}
              onClick={() => setFilter('ready')}
            >
              📦 Ready for Pickup <span className="manager-filter-badge">{stats.ready}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'delivered' ? 'active' : ''}`}
              onClick={() => setFilter('delivered')}
            >
              ✅ Completed <span className="manager-filter-badge">{stats.delivered}</span>
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
              <p>Loading delivery assignments...</p>
            </div>
          )}

          {!loading && filteredOrders.length === 0 && (
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '40px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛵</div>
              <h3 style={{ margin: '0 0 6px' }}>No active tasks</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                Orders packed by the kitchen will appear here ready for pickup.
              </p>
            </div>
          )}

          {/* Delivery Task Cards */}
          <div>
            {filteredOrders.map((order) => {
              const customer = order.customerId;
              const address = order.addressId;
              const isUpdating = updatingId === order._id;
              const shortId = String(order._id).slice(-6).toUpperCase();
              const isCOD = order.paymentMethod === 'cod';

              // Navigation Destination Query (Building name + street, STRICTLY removing flat number for turn-by-turn accuracy)
              const destinationQuery = getBuildingNavigationQuery(address);
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`;

              const cleanPhone = (customer?.phone || '').replace(/\D/g, '').slice(-10);
              const waText = encodeURIComponent(
                `Hello ${customer?.name || ''}, this is your Paranjape Foods delivery partner. I am on the way with your order #PF-${shortId}.`
              );
              const waUrl = `https://wa.me/91${cleanPhone}?text=${waText}`;

              return (
                <div
                  key={order._id}
                  className={`delivery-card status-${order.orderStatus}`}
                >
                  {/* Card Header */}
                  <div className="delivery-card-header">
                    <div>
                      <div className="delivery-order-ref">#PF-{shortId}</div>
                      <div className="delivery-order-meta">
                        Updated {new Date(order.updatedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <span
                      className={`manager-status-pill ${order.orderStatus}`}
                      style={{ fontSize: '0.78rem' }}
                    >
                      {order.orderStatus === 'ready'
                        ? '📦 Ready at Kitchen'
                        : order.orderStatus === 'out_for_delivery'
                        ? '🛵 En Route'
                        : '✅ Delivered'}
                    </span>
                  </div>

                  {/* Payment Collection Callout - Always COLLECT AMOUNT since Razorpay is disabled */}
                  <div className="delivery-payment-banner cod" style={{ background: '#fef7e0', border: '2px solid #f9ab00', padding: '14px 16px' }}>
                    <span style={{ fontSize: '1.8rem' }}>💰</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#b06000', marginBottom: '2px' }}>
                        Payment Required (Razorpay Disabled)
                      </div>
                      <div className="delivery-payment-amount" style={{ color: '#8a5800', fontSize: '1.4rem', fontWeight: 900 }}>
                        COLLECT AMOUNT: ₹{order.totalAmount}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#6d4800', fontWeight: 600, marginTop: '2px' }}>
                        Collect ₹{order.totalAmount} via Cash or UPI QR scan from customer before handing over package.
                      </div>
                    </div>
                  </div>

                  {/* Customer & Address Details */}
                  <div className="delivery-dest-box">
                    <h4>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Customer &amp; Destination Address
                    </h4>

                    <div className="delivery-customer-name">
                      {customer?.name || 'Customer'}
                    </div>

                    <div className="delivery-address-line">
                      {address ? (
                        <>
                          {address.flatNo && (
                            <div style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.05rem', margin: '2px 0 4px' }}>
                              🚪 Door / Flat: {address.flatNo}
                            </div>
                          )}
                          <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text)' }}>
                            🏢 Building: {address.buildingName || address.street || 'Building Location'}
                          </div>
                          {address.street && address.street !== address.buildingName && (
                            <div style={{ fontSize: '0.88rem', color: 'var(--text)', marginTop: '2px' }}>
                              📍 {address.street}
                            </div>
                          )}
                          <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '2px' }}>
                            {address.city || 'Pune'} {address.zipCode ? `- ${address.zipCode}` : ''}
                          </div>
                        </>
                      ) : (
                        <div>Address details not attached</div>
                      )}
                    </div>

                    {/* Quick Rider Action Links */}
                    <div className="delivery-quick-links">
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="delivery-action-pill nav"
                        title="Navigate to building in Google Maps (Flat number removed for GPS accuracy)"
                        style={{ background: '#1a73e8', color: '#ffffff', padding: '10px 14px' }}
                      >
                        🗺️ Google Maps ({destinationQuery.split(',')[0]})
                      </a>
                      {cleanPhone && (
                        <>
                          <a href={`tel:${cleanPhone}`} className="delivery-action-pill call">
                            📞 Call
                          </a>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="delivery-action-pill whatsapp"
                          >
                            💬 WhatsApp
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Dishes in this bag */}
                  <div style={{ marginBottom: '18px', background: 'rgba(0,0,0,0.02)', padding: '10px 12px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: '4px' }}>
                      Dishes in this Package ({order.items?.length || 0} items)
                    </div>
                    {order.items &&
                      order.items.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '2px 0' }}>
                          <span>
                            <strong>{it.quantity}×</strong> {it.title || 'Specialty Dish'}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Rider Primary Action Stepper Button */}
                  <div>
                    {order.orderStatus === 'ready' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleMarkPickedUp(order._id)}
                        className="delivery-cta-btn pickup"
                      >
                        <span>📦</span>
                        <span>{isUpdating ? 'Updating...' : 'Confirm Picked Up (Start Delivery) →'}</span>
                      </button>
                    )}

                    {order.orderStatus === 'out_for_delivery' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleMarkDelivered(order._id, order.totalAmount)}
                        className="delivery-cta-btn deliver"
                        style={{ background: 'linear-gradient(135deg, #137333 0%, #1e8e3e 100%)', padding: '16px' }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>✅</span>
                        <span>{isUpdating ? 'Updating...' : `Collect ₹${order.totalAmount} & Mark Delivered →`}</span>
                      </button>
                    )}

                    {order.orderStatus === 'delivered' && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '12px',
                          background: '#e6f4ea',
                          color: '#137333',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.92rem',
                        }}
                      >
                        ✓ Delivered Successfully
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}
    </>
  );
}
