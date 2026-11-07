import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

export default function ManagerPortal() {
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

  // Kitchen Board State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active', 'all', 'preparing', 'ready', 'out_for_delivery', 'delivered'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const eventSourceRef = useRef(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  // 1. Check existing session on mount
  useEffect(() => {
    const savedToken =
      (typeof window !== 'undefined' && (localStorage.getItem('pf_manager_token') || sessionStorage.getItem('pf_manager_token'))) ||
      null;

    if (!savedToken) {
      setAuthChecking(false);
      return;
    }

    // Verify token with backend
    fetch(`${API_BASE}/api/admin/auth/check`, {
      headers: { 'x-manager-token': savedToken },
    })
      .then((res) => {
        if (res.ok) {
          setToken(savedToken);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('pf_manager_token');
          sessionStorage.removeItem('pf_manager_token');
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

  // 2. Play audio chime using Web Audio API on new orders
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // Audio context might be blocked prior to user interaction
    }
  };

  // 3. Fetch Orders with Auth Token
  const fetchOrders = async (currentToken = token) => {
    if (!currentToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders`, {
        headers: { 'x-manager-token': currentToken },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch admin orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // 4. Connect SSE Stream when Authenticated
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    fetchOrders(token);

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        const es = new EventSource(`${API_BASE}/api/admin/orders/stream?token=${encodeURIComponent(token)}`);
        eventSourceRef.current = es;

        es.addEventListener('connected', () => {
          setIsLiveConnected(true);
        });

        es.addEventListener('new_order', (e) => {
          try {
            const newOrder = JSON.parse(e.data);
            setOrders((prev) => [newOrder, ...prev.filter((o) => o._id !== newOrder._id)]);
            playChime();
            setToastMessage(`🔔 New Order Received: #PF-${String(newOrder._id).slice(-6).toUpperCase()}`);
            setTimeout(() => setToastMessage(''), 6000);
          } catch (err) {
            console.error('Error handling new_order event', err);
          }
        });

        es.addEventListener('admin_order_update', (e) => {
          try {
            const updated = JSON.parse(e.data);
            setOrders((prev) =>
              prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o))
            );
          } catch (err) {
            console.error('Error handling admin_order_update', err);
          }
        });

        es.onerror = () => {
          setIsLiveConnected(false);
        };
      } catch (e) {
        console.warn('Admin SSE not supported or blocked');
      }
    }

    const interval = setInterval(() => {
      fetchOrders(token);
    }, 8000);

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
      setAuthError('Please enter your passcode or PIN.');
      return;
    }

    setAuthSubmitting(true);
    setAuthError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/auth/verify`, {
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
          localStorage.setItem('pf_manager_token', data.token);
        } else {
          sessionStorage.setItem('pf_manager_token', data.token);
        }
      } else {
        setAuthError(data.error || 'Incorrect passcode. Please try again.');
      }
    } catch (err) {
      setAuthError('Unable to authenticate. Please ensure backend is running.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handle Logout / Lock Screen
  const handleLogout = () => {
    localStorage.removeItem('pf_manager_token');
    sessionStorage.removeItem('pf_manager_token');
    setToken(null);
    setIsAuthenticated(false);
    setOrders([]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  // Update order milestone status
  const handleUpdateStatus = async (orderId, newStatus, customNote) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/api/order/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-manager-token': token,
        },
        body: JSON.stringify({
          orderStatus: newStatus,
          note: customNote,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o._id === updated._id ? { ...o, ...updated } : o))
        );
        setToastMessage(`Order #PF-${orderId.slice(-6).toUpperCase()} status updated to "${newStatus}"!`);
        setTimeout(() => setToastMessage(''), 4000);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (filter === 'active') {
      return ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.orderStatus);
    }
    if (filter === 'delivered') return o.orderStatus === 'delivered';
    if (filter === 'all') return true;
    return o.orderStatus === filter;
  });

  const stats = {
    total: orders.length,
    active: orders.filter((o) => ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.orderStatus)).length,
    preparing: orders.filter((o) => o.orderStatus === 'preparing').length,
    ready: orders.filter((o) => o.orderStatus === 'ready').length,
    out_for_delivery: orders.filter((o) => o.orderStatus === 'out_for_delivery').length,
    delivered: orders.filter((o) => o.orderStatus === 'delivered').length,
  };

  // If checking existing session
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
              background: 'var(--accent)',
            }}
          />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>Verifying staff credentials...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Kitchen &amp; Order Manager - Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* =========================================================================
          UNAUTHENTICATED VIEW: Locked Staff Passcode Window
         ========================================================================= */}
      {!isAuthenticated ? (
        <main className="page" style={{ maxWidth: '520px' }}>
          <NavBar />

          <div className="manager-auth-wrapper">
            <div className="manager-auth-card">
              <div className="manager-lock-icon-circle">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <span className="manager-auth-badge">Authorized Personnel Only</span>
              <h2>Kitchen &amp; Order Board</h2>
              <p className="manager-auth-desc">
                Please enter your kitchen staff passcode or PIN to view incoming orders and manage delivery dispatch.
              </p>

              {authError && (
                <div className="error-message" style={{ margin: '0 0 18px', textAlign: 'left' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                <div className="manager-passcode-field">
                  <label htmlFor="passcodeInput">Manager Passcode / PIN</label>
                  <div className="manager-input-container">
                    <input
                      id="passcodeInput"
                      type={showPasscode ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter staff passcode (e.g. paranjape2026)"
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
                  <span>Keep session active on this tablet/device</span>
                </label>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="manager-auth-btn"
                >
                  {authSubmitting ? 'Verifying Passcode...' : 'Unlock Kitchen Board →'}
                </button>
              </form>

              <div className="manager-auth-hint-box">
                🔒 Configured in <code>.env.local</code> as <code>MANAGER_PASSCODE</code> (default: <code>paranjape2026</code> or quick PIN <code>2026</code>).
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* =========================================================================
            AUTHENTICATED VIEW: Full Kitchen Management Dashboard
           ========================================================================= */
        <main className="manager-container">
          <NavBar />

          {/* Real-time Toast Banner */}
          {toastMessage && (
            <div className="manager-toast-banner" role="alert">
              <span style={{ fontSize: '1.2rem' }}>✨</span>
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Manager Topbar */}
          <div className="manager-topbar">
            <div className="manager-title-area">
              <h1>Kitchen &amp; Order Manager</h1>
              <p>Live order management board for chefs, dispatchers &amp; restaurant managers.</p>
            </div>

            <div className="manager-controls">
              <div className="tracker-live-pill">
                <span className="live-pulse-dot" />
                <span>{isLiveConnected ? 'Live Real-Time Sync' : 'Polling Sync'}</span>
              </div>

              <button
                type="button"
                className="manager-refresh-btn"
                onClick={() => setSoundEnabled((prev) => !prev)}
                title={soundEnabled ? 'Mute new order chime' : 'Enable new order chime'}
              >
                {soundEnabled ? '🔔 Chime On' : '🔕 Chime Muted'}
              </button>

              <button
                type="button"
                className="manager-refresh-btn"
                onClick={() => fetchOrders(token)}
                title="Refresh order board"
              >
                🔄 Refresh
              </button>

              <button
                type="button"
                className="manager-signout-btn"
                onClick={handleLogout}
                title="Lock portal and sign out"
              >
                🔒 Lock Portal
              </button>
            </div>
          </div>

          {/* Top Summary Stats Bar */}
          <div className="manager-stats-grid">
            <div
              className={`manager-stat-card ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              <div className="stat-num" style={{ color: 'var(--accent)' }}>{stats.active}</div>
              <div className="stat-label">Active Kitchen</div>
            </div>
            <div
              className={`manager-stat-card ${filter === 'preparing' ? 'active' : ''}`}
              onClick={() => setFilter('preparing')}
            >
              <div className="stat-num" style={{ color: '#1a73e8' }}>{stats.preparing}</div>
              <div className="stat-label">In Kitchen</div>
            </div>
            <div
              className={`manager-stat-card ${filter === 'ready' ? 'active' : ''}`}
              onClick={() => setFilter('ready')}
            >
              <div className="stat-num" style={{ color: '#9334e8' }}>{stats.ready}</div>
              <div className="stat-label">Ready / Packed</div>
            </div>
            <div
              className={`manager-stat-card ${filter === 'out_for_delivery' ? 'active' : ''}`}
              onClick={() => setFilter('out_for_delivery')}
            >
              <div className="stat-num" style={{ color: '#e37400' }}>{stats.out_for_delivery}</div>
              <div className="stat-label">On The Way</div>
            </div>
            <div
              className={`manager-stat-card ${filter === 'delivered' ? 'active' : ''}`}
              onClick={() => setFilter('delivered')}
            >
              <div className="stat-num" style={{ color: '#137333' }}>{stats.delivered}</div>
              <div className="stat-label">Delivered</div>
            </div>
            <div
              className={`manager-stat-card ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              <div className="stat-num">{stats.total}</div>
              <div className="stat-label">Total Orders</div>
            </div>
          </div>

          {/* Segmented Filter Bar */}
          <div className="manager-filter-bar">
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active Orders <span className="manager-filter-badge">{stats.active}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'preparing' ? 'active' : ''}`}
              onClick={() => setFilter('preparing')}
            >
              👨‍🍳 In Kitchen <span className="manager-filter-badge">{stats.preparing}</span>
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
              className={`manager-filter-tab ${filter === 'out_for_delivery' ? 'active' : ''}`}
              onClick={() => setFilter('out_for_delivery')}
            >
              🛵 Out for Delivery <span className="manager-filter-badge">{stats.out_for_delivery}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'delivered' ? 'active' : ''}`}
              onClick={() => setFilter('delivered')}
            >
              ✅ Completed <span className="manager-filter-badge">{stats.delivered}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All <span className="manager-filter-badge">{stats.total}</span>
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
              <p>Loading live kitchen orders...</p>
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
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🍲</div>
              <h3 style={{ margin: '0 0 6px' }}>No orders in this category</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                Incoming customer orders will appear here automatically in real time.
              </p>
            </div>
          )}

          {/* Order Cards Grid */}
          <div className="manager-orders-grid">
            {filteredOrders.map((order) => {
              const customer = order.customerId;
              const address = order.addressId;
              const isUpdating = updatingId === order._id;
              const shortId = String(order._id).slice(-6).toUpperCase();
              const timeAgo = Math.max(
                0,
                Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60))
              );

              return (
                <div
                  key={order._id}
                  className={`manager-order-card status-${order.orderStatus}`}
                >
                  {/* Card Top: Order ID & Status */}
                  <div className="manager-card-top">
                    <div>
                      <div className="manager-order-id">#PF-{shortId}</div>
                      <div className="manager-order-time">
                        Placed {timeAgo === 0 ? 'just now' : `${timeAgo} min ago`} •{' '}
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="manager-card-actions-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`manager-status-pill ${order.orderStatus}`}>
                        {order.orderStatus.replace(/_/g, ' ')}
                      </span>
                      <a
                        href={`/track?orderId=${order._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="manager-phone-btn"
                        title="Preview Amazon-style customer tracking view"
                        style={{ fontSize: '0.78rem', background: '#fcf8f2', border: '1px solid var(--border)' }}
                      >
                        🔗 Customer View
                      </a>
                    </div>
                  </div>

                  {/* Customer Details & Delivery Address */}
                  <div className="manager-order-body">
                    <div className="manager-info-box">
                      <h5>Customer</h5>
                      <div className="manager-customer-name">
                        {customer?.name || 'Customer'}
                      </div>
                      {customer?.phone && (
                        <div className="manager-phone-links">
                          <a href={`tel:${customer.phone}`} className="manager-phone-btn">
                            📞 {customer.phone}
                          </a>
                          <a
                            href={`https://wa.me/91${customer.phone.replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="manager-phone-btn whatsapp"
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="manager-info-box">
                      <h5>Delivery Destination</h5>
                      <div className="manager-address-text">
                        {address ? (
                          <>
                            {address.flatNo && (
                              <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.92rem' }}>
                                🚪 Door: {address.flatNo}
                              </div>
                            )}
                            <div style={{ fontWeight: 600 }}>
                              🏢 {address.buildingName || address.street}
                            </div>
                            {address.street && address.street !== address.buildingName && (
                              <div style={{ fontSize: '0.84rem' }}>{address.street}</div>
                            )}
                            <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                              {address.city} {address.zipCode ? `- ${address.zipCode}` : ''}
                            </div>
                          </>
                        ) : (
                          <div style={{ color: 'var(--muted)' }}>Address not linked</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Food Items Ordered */}
                  <table className="manager-items-table">
                    <tbody>
                      {order.items &&
                        order.items.map((it, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600, width: '40px', color: 'var(--accent)' }}>
                              {it.quantity}×
                            </td>
                            <td>{it.title || 'Specialty Dish'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ₹{it.price * it.quantity}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {/* Payment & Next Stage Action Stepper */}
                  <div className="manager-actions-row">
                    <div>
                      <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>Payment: </span>
                      <strong style={{ fontSize: '0.92rem' }}>
                        {order.paymentMethod === 'cod' ? 'Cash/UPI on Delivery' : 'Paid Online'} (₹{order.totalAmount})
                      </strong>
                    </div>

                    {/* Progressive Milestone Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {order.orderStatus === 'placed' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order._id, 'preparing')}
                          className="manager-action-btn prepare"
                        >
                          👨‍🍳 Start Preparing &amp; Cooking
                        </button>
                      )}

                      {order.orderStatus === 'preparing' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order._id, 'ready')}
                          className="manager-action-btn ready"
                        >
                          📦 Mark Packed &amp; Ready for Pickup
                        </button>
                      )}

                      {order.orderStatus === 'ready' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order._id, 'out_for_delivery')}
                          className="manager-action-btn dispatch"
                        >
                          🛵 Dispatch (Out for Delivery)
                        </button>
                      )}

                      {order.orderStatus === 'out_for_delivery' && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order._id, 'delivered')}
                          className="manager-action-btn deliver"
                        >
                          ✅ Confirm Handed Over (Delivered)
                        </button>
                      )}

                      {order.orderStatus === 'delivered' && (
                        <span
                          style={{
                            color: '#137333',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            padding: '6px 12px',
                            background: '#e6f4ea',
                            borderRadius: '8px',
                          }}
                        >
                          ✓ Order Completed
                        </span>
                      )}

                      {['placed', 'preparing'].includes(order.orderStatus) && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this order?')) {
                              handleUpdateStatus(order._id, 'cancelled', 'Cancelled by kitchen/customer request.');
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#c94f2f',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            padding: '6px 8px',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
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
