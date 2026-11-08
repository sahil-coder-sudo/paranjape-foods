import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

// Strips flat/room numbers to keep ONLY building name, street & city for accurate Google Maps turn-by-turn navigation
function getBuildingNavigationQuery(addr) {
  if (!addr) return 'Delivery Destination';

  // 1. If buildingName is explicitly present, compose: buildingName + street + city
  if (addr.buildingName) {
    const parts = [
      addr.buildingName,
      addr.street && addr.street !== addr.buildingName ? addr.street : null,
      addr.city || '',
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

  const parts = [cleaned || raw, addr.city || '', addr.zipCode || ''].filter(Boolean);
  return parts.join(', ');
}

export default function DeliveryPortal() {
  const router = useRouter();

  // Authentication State
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [staffUser, setStaffUser] = useState(null); // { id, name, phone, role, vehicleNumber }
  const [authMode, setAuthMode] = useState('phone'); // 'phone' | 'passcode'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Passcode Self-Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [showShiftReport, setShowShiftReport] = useState(false);
  const [adminRecoveryKey, setAdminRecoveryKey] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [resetStatus, setResetStatus] = useState({ text: '', type: '' });
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const handleSelfReset = async (e) => {
    e.preventDefault();
    setResetSubmitting(true);
    setResetStatus({ text: '', type: '' });

    try {
      const res = await fetch(`${API_BASE}/api/admin/staff/self-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'delivery',
          adminRecoveryKey: adminRecoveryKey.trim(),
          newPasscode: newPasscode.trim(),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setResetStatus({ text: data.message || 'Passcode updated successfully!', type: 'success' });
        setTimeout(() => {
          setShowResetModal(false);
          setPasscode(newPasscode.trim());
          setAdminRecoveryKey('');
          setNewPasscode('');
          setResetStatus({ text: '', type: '' });
        }, 1800);
      } else {
        setResetStatus({ text: data.error || 'Failed to reset passcode. Please check Admin Recovery Key.', type: 'error' });
      }
    } catch (err) {
      setResetStatus({ text: 'Network error resetting passcode.', type: 'error' });
    } finally {
      setResetSubmitting(false);
    }
  };

  // Delivery Orders State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'my_deliveries', 'active', 'ready', 'out_for_delivery', 'delivered'
  const [toastMessage, setToastMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const eventSourceRef = useRef(null);
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

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
    const savedUserStr =
      (typeof window !== 'undefined' &&
        (localStorage.getItem('pf_delivery_user') || sessionStorage.getItem('pf_delivery_user'))) ||
      null;
    if (savedUserStr) {
      try {
        setStaffUser(JSON.parse(savedUserStr));
      } catch (e) {}
    }

    if (!savedToken) {
      setAuthChecking(false);
      return;
    }

    fetch(`${API_BASE}/api/delivery/auth/check`, {
      headers: { 'x-delivery-token': savedToken },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Invalid rider session');
      })
      .then((data) => {
        setToken(savedToken);
        setIsAuthenticated(true);
        if (data.user) {
          setStaffUser(data.user);
          localStorage.setItem('pf_delivery_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {
        localStorage.removeItem('pf_delivery_token');
        localStorage.removeItem('pf_delivery_user');
        sessionStorage.removeItem('pf_delivery_token');
        sessionStorage.removeItem('pf_delivery_user');
        setIsAuthenticated(false);
        setStaffUser(null);
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
    setAuthSubmitting(true);
    setAuthError('');

    const isPhoneMode = authMode === 'phone';
    if (isPhoneMode) {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        setAuthError('Please enter a valid 10-digit mobile number.');
        setAuthSubmitting(false);
        return;
      }
      if (!password.trim()) {
        setAuthError('Please enter your rider PIN.');
        setAuthSubmitting(false);
        return;
      }
    } else {
      if (!passcode.trim()) {
        setAuthError('Please enter your rider PIN or passcode.');
        setAuthSubmitting(false);
        return;
      }
    }

    try {
      const payload = isPhoneMode
        ? { phone: phone.trim(), password: password.trim() }
        : { passcode: passcode.trim() };

      const res = await fetch(`${API_BASE}/api/delivery/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setToken(data.token);
        setIsAuthenticated(true);
        if (data.user) {
          setStaffUser(data.user);
        }
        setPhone('');
        setPassword('');
        setPasscode('');

        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('pf_delivery_token', data.token);
        if (data.user) {
          storage.setItem('pf_delivery_user', JSON.stringify(data.user));
        }
      } else {
        setAuthError(data.error || 'Incorrect rider credentials. Please try again.');
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
    localStorage.removeItem('pf_delivery_user');
    sessionStorage.removeItem('pf_delivery_token');
    sessionStorage.removeItem('pf_delivery_user');
    setToken(null);
    setStaffUser(null);
    setIsAuthenticated(false);
    setOrders([]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  // Action: Mark order Picked Up (Out for Delivery)
  const handleMarkPickedUp = async (order) => {
    const orderId = String(order._id || '');
    if (order.assignedRiderId && !isMyOrder(order)) {
      const otherName = order.assignedRiderId.name || 'another rider';
      if (
        !window.confirm(
          `⚠️ Notice: Order #PF-${orderId.slice(-6).toUpperCase()} is currently assigned to ${otherName}.\n\nDo you want to take over and mark it picked up?`
        )
      ) {
        return;
      }
    }

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
  const handleMarkDelivered = async (rawOrderId, totalAmount, paymentMethod) => {
    const orderId = String(rawOrderId || '');
    const isOnlinePaid = paymentMethod === 'razorpay';
    const confirmPrompt = isOnlinePaid
      ? `Confirm Handed to Resident for Order #PF-${orderId.slice(-6).toUpperCase()}?\n\n` +
        `✓ PAID ONLINE VIA UPI: ₹${totalAmount} already paid. No cash collection required.`
      : `Confirm Handed to Resident for Order #PF-${orderId.slice(-6).toUpperCase()}?\n\n` +
        `💰 MANDATORY PAYMENT CHECK:\n` +
        `Have you collected ₹${totalAmount} from the resident via Cash or UPI QR scan?`;

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
        setToastMessage(`🎉 Order #PF-${orderId.slice(-6).toUpperCase()} handed to resident and ₹${totalAmount} collected!`);
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

  // Helper: check if order is assigned to current logged-in rider
  const currentStaffId = staffUser?.id || staffUser?._id;
  const isMyOrder = (o) => {
    if (!currentStaffId || !o.assignedRiderId) return false;
    const riderId = typeof o.assignedRiderId === 'object' ? o.assignedRiderId._id : o.assignedRiderId;
    return String(riderId) === String(currentStaffId);
  };

  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const isOrderToday = (o) => {
    if (!o || !o.createdAt) return false;
    return new Date(o.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayIST;
  };

  const myDeliveredToday = orders.filter((o) => isMyOrder(o) && o.orderStatus === 'delivered' && isOrderToday(o));
  const myCashCollectedToday = myDeliveredToday.reduce((sum, o) => {
    const isCOD = o.paymentMethod === 'cod' || !o.paymentMethod;
    return isCOD ? sum + (Number(o.totalAmount) || 0) : sum;
  }, 0);
  const myOnlineDeliveredToday = myDeliveredToday.reduce((sum, o) => {
    const isUPI = o.paymentMethod === 'razorpay' || o.paymentMethod === 'upi';
    return isUPI ? sum + (Number(o.totalAmount) || 0) : sum;
  }, 0);

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (filter === 'my_deliveries') {
      return isMyOrder(o) && ['ready', 'out_for_delivery'].includes(o.orderStatus);
    }
    if (filter === 'active') return ['ready', 'out_for_delivery'].includes(o.orderStatus);
    if (filter === 'ready') return o.orderStatus === 'ready';
    if (filter === 'out_for_delivery') return o.orderStatus === 'out_for_delivery';
    if (filter === 'delivered') return o.orderStatus === 'delivered' && isOrderToday(o);
    if (filter === 'all_delivered') return o.orderStatus === 'delivered';
    return true;
  });

  const stats = {
    myDeliveries: orders.filter((o) => isMyOrder(o) && ['ready', 'out_for_delivery'].includes(o.orderStatus)).length,
    active: orders.filter((o) => ['ready', 'out_for_delivery'].includes(o.orderStatus)).length,
    inTransit: orders.filter((o) => o.orderStatus === 'out_for_delivery').length,
    ready: orders.filter((o) => o.orderStatus === 'ready').length,
    deliveredToday: myDeliveredToday.length,
    allDeliveredToday: orders.filter((o) => o.orderStatus === 'delivered' && isOrderToday(o)).length,
    cashCollectedToday: myCashCollectedToday,
    onlineDeliveredToday: myOnlineDeliveredToday,
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
              background: '#01621f',
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
                  background: 'linear-gradient(135deg, rgba(1, 98, 31, 0.12) 0%, rgba(1, 98, 31, 0.04) 100%)',
                  color: '#01621f',
                  borderColor: 'rgba(1, 98, 31, 0.25)',
                }}
              >
                <span style={{ fontSize: '1.8rem' }}>🛵</span>
              </div>

              <span
                className="manager-auth-badge"
                style={{ background: '#e6f5eb', color: '#01621f', borderColor: 'rgba(1, 98, 31, 0.2)' }}
              >
                Delivery Partner App
              </span>
              <h2>Rider Dispatch Portal</h2>
              <p className="manager-auth-desc">
                Log in with your registered phone number &amp; rider PIN, or enter your delivery team passcode.
              </p>

              {/* Mode Switcher Tabs */}
              <div style={{ display: 'flex', background: '#eef6f0', borderRadius: '10px', padding: '4px', marginBottom: '20px', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => { setAuthMode('phone'); setAuthError(''); }}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: authMode === 'phone' ? '#fff' : 'transparent',
                    color: authMode === 'phone' ? '#01621f' : 'var(--muted)',
                    boxShadow: authMode === 'phone' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  🛵 Phone &amp; Rider PIN
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('passcode'); setAuthError(''); }}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: authMode === 'passcode' ? '#fff' : 'transparent',
                    color: authMode === 'passcode' ? '#01621f' : 'var(--muted)',
                    boxShadow: authMode === 'passcode' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  🔑 Quick Passcode
                </button>
              </div>

              {authError && (
                <div className="error-message" style={{ margin: '0 0 18px', textAlign: 'left' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                {authMode === 'phone' ? (
                  <>
                    <div className="manager-passcode-field">
                      <label htmlFor="riderPhoneInput">10-Digit Mobile Number</label>
                      <div className="manager-input-container">
                        <input
                          id="riderPhoneInput"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="e.g. 9876540002"
                          maxLength={10}
                          required
                          autoFocus
                          className="manager-passcode-input"
                          style={{ letterSpacing: '1px' }}
                        />
                      </div>
                    </div>

                    <div className="manager-passcode-field">
                      <label htmlFor="riderPasswordInput">Rider Security PIN / Password</label>
                      <div className="manager-input-container">
                        <input
                          id="riderPasswordInput"
                          type={showPasscode ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your rider PIN (e.g. rider2026)"
                          required
                          className="manager-passcode-input"
                        />
                        <button
                          type="button"
                          className="manager-eye-btn"
                          onClick={() => setShowPasscode((prev) => !prev)}
                          title={showPasscode ? 'Hide PIN' : 'Show PIN'}
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
                  </>
                ) : (
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
                )}

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
                  style={{ background: '#01621f', boxShadow: '0 4px 14px rgba(1, 98, 31, 0.28)' }}
                >
                  {authSubmitting ? 'Verifying Rider PIN...' : 'Start Delivery Shift 🛵 →'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => { setShowResetModal(true); setResetStatus({ text: '', type: '' }); }}
                  style={{ background: 'none', border: 'none', color: '#01621f', cursor: 'pointer', fontSize: '0.84rem', textDecoration: 'underline' }}
                >
                  Forgot / Reset Rider Passcode?
                </button>
              </div>

              <div className="manager-auth-hint-box">
                {authMode === 'phone' ? (
                  <span>🛵 Default Rider mobile: <code>9876540002</code> with PIN <code>rider2026</code>. Manage fleet in <a href="/admin" style={{ color: '#01621f', fontWeight: 'bold' }}>Master Admin</a>.</span>
                ) : (
                  <span>🛵 Fallback passcode configured in <code>.env.local</code> as <code>DELIVERY_PASSCODE</code> (default: <code>rider2026</code> or quick PIN <code>1234</code>).</span>
                )}
              </div>
            </div>
          </div>

          {/* Self-Reset Modal */}
          {showResetModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>Reset Delivery Rider Passcode</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 16px' }}>
                  Enter the Super Admin Recovery Key (default: <code>admin2026</code>) to define a new Delivery Partner passcode.
                </p>

                <form onSubmit={handleSelfReset}>
                  <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.85rem' }}>Admin Recovery Key</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter Admin Recovery Key"
                      value={adminRecoveryKey}
                      onChange={(e) => setAdminRecoveryKey(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                    />
                  </div>

                  <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.85rem' }}>New Rider Passcode (min 4 chars)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. rider2026 or 7788"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                    />
                  </div>

                  {resetStatus.text && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '14px', background: resetStatus.type === 'success' ? '#e6f5eb' : '#fce8e6', color: resetStatus.type === 'success' ? '#01621f' : '#c5221f' }}>
                      {resetStatus.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="button-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                      disabled={resetSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="button"
                      style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#01621f', borderColor: '#01621f' }}
                      disabled={resetSubmitting || !adminRecoveryKey || !newPasscode}
                    >
                      {resetSubmitting ? 'Updating...' : 'Set New Passcode'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {staffUser && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#e6f5eb', padding: '6px 14px', borderRadius: '20px', fontSize: '0.84rem', border: '1px solid #a3d9b4', color: '#01621f' }}>
                  <span>🛵</span>
                  <span><strong>{staffUser.name}</strong></span>
                  {staffUser.vehicleNumber && (
                    <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#01621f', color: '#fff', fontSize: '0.72rem', fontWeight: 'bold' }}>
                      {staffUser.vehicleNumber}
                    </span>
                  )}
                </div>
              )}

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
                onClick={() => setShowShiftReport(true)}
                style={{ background: '#e6f5eb', color: '#01621f', borderColor: '#a3d9b4', fontWeight: 700 }}
                title="View shift settlement & cash to hand over"
              >
                📑 My Shift Report
              </button>

              <button
                type="button"
                className="manager-refresh-btn"
                onClick={() => fetchDeliveryOrders(token)}
                title="Refresh tasks"
              >
                🔄 Refresh
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

          {/* Top Quick Stats Grid (Daily operational metrics reset at midnight) */}
          <div className="manager-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: '18px' }}>
            <div
              className={`manager-stat-card ${filter === 'my_deliveries' ? 'active' : ''}`}
              onClick={() => setFilter('my_deliveries')}
              style={{ borderColor: filter === 'my_deliveries' ? '#01621f' : undefined }}
            >
              <div className="stat-num" style={{ color: '#01621f' }}>{stats.myDeliveries}</div>
              <div className="stat-label">⭐ My Tasks</div>
            </div>
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
              <div className="stat-num" style={{ color: '#01621f' }}>{stats.deliveredToday}</div>
              <div className="stat-label">Delivered Today</div>
              <div style={{ fontSize: '0.68rem', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>Resets Midnight</div>
            </div>
            <div
              className="manager-stat-card"
              style={{ background: '#fef7e0', borderColor: '#f9ab00', cursor: 'pointer' }}
              onClick={() => setShowShiftReport(true)}
              title="Click to view cash settlement breakdown"
            >
              <div className="stat-num" style={{ color: '#8a5800' }}>₹{stats.cashCollectedToday}</div>
              <div className="stat-label">Cash to Turn In</div>
              <div style={{ fontSize: '0.68rem', color: '#b06000', marginTop: '2px', fontWeight: 600 }}>Hand to Kitchen →</div>
            </div>
          </div>

          {/* Segmented Filter Bar */}
          <div className="manager-filter-bar" style={{ marginBottom: '18px' }}>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'my_deliveries' ? 'active' : ''}`}
              onClick={() => setFilter('my_deliveries')}
              style={{ fontWeight: 700 }}
            >
              ⭐ My Deliveries <span className="manager-filter-badge">{stats.myDeliveries}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              📋 All Active <span className="manager-filter-badge">{stats.active}</span>
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
              🛵 In Transit <span className="manager-filter-badge">{stats.inTransit}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'delivered' ? 'active' : ''}`}
              onClick={() => setFilter('delivered')}
            >
              ✅ Delivered Today <span className="manager-filter-badge">{stats.deliveredToday}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'all_delivered' ? 'active' : ''}`}
              onClick={() => setFilter('all_delivered')}
            >
              🗓️ All Completed <span className="manager-filter-badge">{stats.allDeliveredToday}</span>
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

                      {/* Fleet Assignment Badge */}
                      <div style={{ marginTop: '6px' }}>
                        {isMyOrder(order) ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#e6f5eb',
                              color: '#01621f',
                              border: '1px solid #a3d9b4',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                            }}
                          >
                            ⭐ Assigned to You
                          </span>
                        ) : order.assignedRiderId ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#f1f3f4',
                              color: '#3c4043',
                              border: '1px solid #dadce0',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                            }}
                          >
                            🛵 Assigned: {order.assignedRiderId.name || 'Other Rider'}
                            {order.assignedRiderId.vehicleNumber ? ` (${order.assignedRiderId.vehicleNumber})` : ''}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#fef7e0',
                              color: '#b06000',
                              border: '1px solid #f9ab00',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                            }}
                          >
                            ⚠️ Unassigned Pool (Open to any rider)
                          </span>
                        )}
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

                  {/* Payment Collection Callout */}
                  {order.paymentMethod === 'razorpay' ? (
                    <div className="delivery-payment-banner" style={{ background: '#e6f5eb', border: '2px solid #a3d9b4', padding: '14px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '1.8rem' }}>✓</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#01621f', marginBottom: '2px' }}>
                          ✓ Paid Online via UPI (Razorpay Verified)
                        </div>
                        <div className="delivery-payment-amount" style={{ color: '#01621f', fontSize: '1.25rem', fontWeight: 900 }}>
                          DO NOT COLLECT CASH (₹{order.totalAmount} Paid)
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#14532d', fontWeight: 600, marginTop: '2px' }}>
                          Customer has completed payment online. Simply hand over the fresh package to the resident.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="delivery-payment-banner cod" style={{ background: '#fef7e0', border: '2px solid #f9ab00', padding: '14px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '1.8rem' }}>💰</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#b06000', marginBottom: '2px' }}>
                          Payment Required on Delivery
                        </div>
                        <div className="delivery-payment-amount" style={{ color: '#8a5800', fontSize: '1.4rem', fontWeight: 900 }}>
                          COLLECT AMOUNT: ₹{order.totalAmount}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#6d4800', fontWeight: 600, marginTop: '2px' }}>
                          Collect ₹{order.totalAmount} via Cash or UPI QR scan from customer before handing over package.
                        </div>
                      </div>
                    </div>
                  )}

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
                            {address.city ? address.city : ''} {address.zipCode ? `- ${address.zipCode}` : ''}
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
                        onClick={() => handleMarkPickedUp(order)}
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
                        onClick={() => handleMarkDelivered(order._id, order.totalAmount, order.paymentMethod)}
                        className="delivery-cta-btn deliver"
                        style={{ background: 'linear-gradient(135deg, #01621f 0%, #017a27 100%)', padding: '16px' }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>✅</span>
                        <span>
                          {isUpdating
                            ? 'Updating...'
                            : order.paymentMethod === 'razorpay'
                            ? 'Confirm Handed to Resident →'
                            : `Collect ₹${order.totalAmount} & Mark Handed to Resident →`}
                        </span>
                      </button>
                    )}

                    {order.orderStatus === 'delivered' && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '12px',
                          background: '#e6f5eb',
                          color: '#01621f',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.92rem',
                        }}
                      >
                        ✓ Handed to Resident (Delivered)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIDER SHIFT SETTLEMENT REPORT MODAL */}
          {showShiftReport && (
            <div className="admin-modal-backdrop" onClick={() => setShowShiftReport(false)}>
              <div
                className="admin-modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '680px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>
                      📑 Rider Shift Settlement Report
                    </h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.84rem' }}>
                      Reconciliation for {staffUser?.name || 'Rider'} {staffUser?.vehicleNumber ? `(${staffUser.vehicleNumber})` : ''} • Date: {todayIST}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="button-secondary"
                      style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                      title="Print or Save as PDF"
                    >
                      🖨️ Print Slip
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowShiftReport(false)}
                      style={{
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        padding: '7px 12px',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                {/* Settlement Highlights */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                  <div style={{ padding: '14px', background: '#fef7e0', borderRadius: '12px', border: '1.5px solid #f9ab00' }}>
                    <div style={{ fontSize: '0.74rem', color: '#b06000', fontWeight: 800, textTransform: 'uppercase' }}>
                      💰 Cash to Turn In
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#8a5800', marginTop: '2px' }}>
                      ₹{stats.cashCollectedToday}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6d4800', marginTop: '2px' }}>
                      Hand over to kitchen manager
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #a3d9b4' }}>
                    <div style={{ fontSize: '0.74rem', color: '#01621f', fontWeight: 800, textTransform: 'uppercase' }}>
                      ✅ Completed Deliveries
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#01621f', marginTop: '2px' }}>
                      {stats.deliveredToday}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                      Handed to residents today
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 800, textTransform: 'uppercase' }}>
                      💳 Online UPI Deliveries
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>
                      ₹{stats.onlineDeliveredToday}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                      Pre-paid (No cash collection)
                    </div>
                  </div>
                </div>

                {/* Delivered Orders Ledger */}
                <h4 style={{ margin: '0 0 10px', fontSize: '0.94rem', color: 'var(--text)' }}>
                  🛵 Shift Delivery Ledger ({myDeliveredToday.length} orders)
                </h4>
                {myDeliveredToday.length > 0 ? (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <table className="admin-table" style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Order &amp; Time</th>
                          <th>Destination</th>
                          <th>Payment Mode</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myDeliveredToday.map((o) => (
                          <tr key={o._id}>
                            <td>
                              <div style={{ fontWeight: 800, color: 'var(--accent)' }}>#{String(o._id || '').slice(-6).toUpperCase()}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                {new Date(o.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{o.addressId?.buildingName || o.addressId?.street || 'Destination'}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                {o.addressId?.flatNo ? `${o.addressId.flatNo}, ` : ''}{o.addressId?.street || ''}
                              </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  background: o.paymentMethod === 'razorpay' ? '#e6f5eb' : '#fef7e0',
                                  color: o.paymentMethod === 'razorpay' ? '#01621f' : '#b06000',
                                }}
                              >
                                {o.paymentMethod === 'razorpay' ? '✓ Paid Online (UPI)' : '💰 Cash Collected'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: o.paymentMethod === 'razorpay' ? '#01621f' : '#b06000', fontSize: '0.92rem' }}>
                              ₹{o.totalAmount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '0.84rem' }}>
                    No completed deliveries recorded yet for today&apos;s shift ({todayIST}).
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
                  <button
                    type="button"
                    onClick={() => setShowShiftReport(false)}
                    className="button-secondary"
                  >
                    Close Shift Slip
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </>
  );
}
