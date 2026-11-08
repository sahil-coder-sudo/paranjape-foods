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
  const [staffUser, setStaffUser] = useState(null); // { id, name, phone, role }
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
          role: 'manager',
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

  // Address Edit Modal State
  const [editingAddressOrder, setEditingAddressOrder] = useState(null);
  const [editAddressForm, setEditAddressForm] = useState({
    flatNo: '',
    buildingName: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [addressSaveError, setAddressSaveError] = useState('');

  // Delivery Rider Assignment State
  const [riders, setRiders] = useState([]);
  const [assignModalOrder, setAssignModalOrder] = useState(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  const fetchRiders = async (currentToken = token) => {
    if (!currentToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/staff/riders`, {
        headers: { 'x-manager-token': currentToken },
      });
      if (res.ok) {
        const data = await res.json();
        setRiders(data);
      }
    } catch (err) {
      console.error('Failed to load riders:', err);
    }
  };

  const openAssignModal = (order) => {
    setAssignModalOrder(order);
    setSelectedRiderId(order.assignedRiderId?._id || order.assignedRiderId || '');
    setAssignError('');
  };

  const handleAssignRider = async (e) => {
    e.preventDefault();
    if (!assignModalOrder) return;
    setAssignSubmitting(true);
    setAssignError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/order/${assignModalOrder._id}/assign-rider`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-manager-token': token,
        },
        body: JSON.stringify({ riderId: selectedRiderId || null }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === assignModalOrder._id ? { ...o, ...data.order } : o))
        );
        setToastMessage(`🛵 Order #PF-${String(assignModalOrder._id).slice(-6).toUpperCase()} ${selectedRiderId ? 'assigned to ' + (data.rider?.name || 'rider') : 'unassigned'}!`);
        setTimeout(() => setToastMessage(''), 4500);
        setAssignModalOrder(null);
      } else {
        setAssignError(data.error || 'Failed to assign rider.');
      }
    } catch (err) {
      setAssignError('Network error assigning rider.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const openEditAddressModal = (order) => {
    const addr = order.addressId || {};
    setEditingAddressOrder(order);
    setEditAddressForm({
      flatNo: addr.flatNo || '',
      buildingName: addr.buildingName || '',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      zipCode: addr.zipCode || '',
    });
    setAddressSaveError('');
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!editingAddressOrder) return;
    setAddressSubmitting(true);
    setAddressSaveError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/order/${editingAddressOrder._id}/address`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-manager-token': token,
        },
        body: JSON.stringify(editAddressForm),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === editingAddressOrder._id ? { ...o, addressId: data.address } : o))
        );
        setToastMessage(`📍 Address updated for order #PF-${String(editingAddressOrder._id).slice(-6).toUpperCase()}!`);
        setTimeout(() => setToastMessage(''), 4000);
        setEditingAddressOrder(null);
      } else {
        setAddressSaveError(data.error || 'Failed to update address.');
      }
    } catch (err) {
      setAddressSaveError('Network error updating address.');
    } finally {
      setAddressSubmitting(false);
    }
  };

  // Kitchen Board State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active', 'today', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'all'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  // Daily Settlement Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDate, setReportDate] = useState(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  });
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const eventSourceRef = useRef(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  const fetchDailyReport = async (date = reportDate) => {
    setReportLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reports?period=daily&date=${date}`, {
        headers: { 'x-manager-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error('Failed to load daily report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  const openDailyReportModal = () => {
    setShowReportModal(true);
    fetchDailyReport(reportDate);
  };

  const handleExportManagerCSV = () => {
    if (!reportData || !reportData.timeline || reportData.timeline.length === 0) {
      alert('No data recorded for this date.');
      return;
    }
    const day = reportData.timeline[0];
    const headers = ['Order ID', 'Time (IST)', 'Customer', 'Phone', 'Address', 'Dishes', 'Payment Mode', 'Status', 'Rider', 'Amount (INR)'];
    const rows = (day.orders || []).map((o) => [
      `"#${o.shortId}"`,
      `"${new Date(o.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}"`,
      `"${(o.customerName || 'Customer').replace(/"/g, '""')}"`,
      `"${o.customerPhone || '-'}"`,
      `"${(o.addressSummary || '-').replace(/"/g, '""')}"`,
      `"${(o.dishesText || '-').replace(/"/g, '""')}"`,
      `"${o.paymentMethod === 'razorpay' ? 'Online UPI (Razorpay)' : 'Cash / UPI on Delivery'}"`,
      `"${o.orderStatus}"`,
      `"${(o.riderName || 'Unassigned').replace(/"/g, '""')}"`,
      o.totalAmount || 0,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `ParanjapeFoods_KitchenReport_${reportDate}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Check existing session on mount
  useEffect(() => {
    const savedToken =
      (typeof window !== 'undefined' && (localStorage.getItem('pf_manager_token') || sessionStorage.getItem('pf_manager_token'))) ||
      null;
    const savedUserStr =
      (typeof window !== 'undefined' && (localStorage.getItem('pf_manager_user') || sessionStorage.getItem('pf_manager_user'))) ||
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

    // Verify token with backend
    fetch(`${API_BASE}/api/admin/auth/check`, {
      headers: { 'x-manager-token': savedToken },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Invalid session');
      })
      .then((data) => {
        setToken(savedToken);
        setIsAuthenticated(true);
        if (data.user) {
          setStaffUser(data.user);
          localStorage.setItem('pf_manager_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {
        localStorage.removeItem('pf_manager_token');
        localStorage.removeItem('pf_manager_user');
        sessionStorage.removeItem('pf_manager_token');
        sessionStorage.removeItem('pf_manager_user');
        setIsAuthenticated(false);
        setStaffUser(null);
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
    fetchRiders(token);

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
    fetchRiders(token);
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
        setAuthError('Please enter your staff password.');
        setAuthSubmitting(false);
        return;
      }
    } else {
      if (!passcode.trim()) {
        setAuthError('Please enter your staff passcode.');
        setAuthSubmitting(false);
        return;
      }
    }

    try {
      const payload = isPhoneMode
        ? { phone: phone.trim(), password: password.trim() }
        : { passcode: passcode.trim() };

      const res = await fetch(`${API_BASE}/api/admin/auth/verify`, {
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
        storage.setItem('pf_manager_token', data.token);
        if (data.user) {
          storage.setItem('pf_manager_user', JSON.stringify(data.user));
        }
      } else {
        setAuthError(data.error || 'Authentication failed. Please check your credentials.');
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
    localStorage.removeItem('pf_manager_user');
    sessionStorage.removeItem('pf_manager_token');
    sessionStorage.removeItem('pf_manager_user');
    setToken(null);
    setStaffUser(null);
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

  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const isOrderToday = (o) => {
    if (!o || !o.createdAt) return false;
    return new Date(o.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayIST;
  };

  const todayOrders = orders.filter(isOrderToday);
  const todayDelivered = todayOrders.filter((o) => o.orderStatus === 'delivered');
  const todayRevenue = todayOrders.reduce((sum, o) => (o.orderStatus !== 'cancelled' ? sum + (Number(o.totalAmount) || 0) : sum), 0);
  const todayUpi = todayOrders.reduce((sum, o) => ((o.paymentMethod === 'razorpay' || o.paymentMethod === 'upi') && o.orderStatus !== 'cancelled' ? sum + (Number(o.totalAmount) || 0) : sum), 0);
  const todayCash = todayRevenue - todayUpi;

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (filter === 'active') {
      return ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.orderStatus);
    }
    if (filter === 'today') {
      return isOrderToday(o);
    }
    if (filter === 'delivered') return o.orderStatus === 'delivered' && isOrderToday(o);
    if (filter === 'all') return true;
    return o.orderStatus === filter;
  });

  const stats = {
    total: orders.length,
    todayTotal: todayOrders.length,
    active: orders.filter((o) => ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.orderStatus)).length,
    preparing: orders.filter((o) => o.orderStatus === 'preparing').length,
    ready: orders.filter((o) => o.orderStatus === 'ready').length,
    out_for_delivery: orders.filter((o) => o.orderStatus === 'out_for_delivery').length,
    deliveredToday: todayDelivered.length,
    todayRevenue,
    todayUpi,
    todayCash,
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
                Log in with your registered mobile number &amp; password, or enter your kitchen staff passcode.
              </p>

              {/* Mode Switcher Tabs */}
              <div style={{ display: 'flex', background: '#f8f9fa', borderRadius: '10px', padding: '4px', marginBottom: '20px', gap: '4px' }}>
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
                    color: authMode === 'phone' ? 'var(--accent)' : 'var(--muted)',
                    boxShadow: authMode === 'phone' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📱 Mobile &amp; Password
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
                    color: authMode === 'passcode' ? 'var(--accent)' : 'var(--muted)',
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
                      <label htmlFor="managerPhoneInput">10-Digit Mobile Number</label>
                      <div className="manager-input-container">
                        <input
                          id="managerPhoneInput"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="e.g. 9876540001"
                          maxLength={10}
                          required
                          autoFocus
                          className="manager-passcode-input"
                          style={{ letterSpacing: '1px' }}
                        />
                      </div>
                    </div>

                    <div className="manager-passcode-field">
                      <label htmlFor="managerPassInput">Account Password</label>
                      <div className="manager-input-container">
                        <input
                          id="managerPassInput"
                          type={showPasscode ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          required
                          className="manager-passcode-input"
                        />
                        <button
                          type="button"
                          className="manager-eye-btn"
                          onClick={() => setShowPasscode((prev) => !prev)}
                          title={showPasscode ? 'Hide password' : 'Show password'}
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
                )}

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
                  {authSubmitting ? 'Authenticating...' : 'Unlock Kitchen Board →'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => { setShowResetModal(true); setResetStatus({ text: '', type: '' }); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.84rem', textDecoration: 'underline' }}
                >
                  Forgot / Reset Manager Passcode?
                </button>
              </div>

              <div className="manager-auth-hint-box">
                {authMode === 'phone' ? (
                  <span>🔒 Default Owner / Manager mobile: <code>9876540001</code> with password <code>paranjape2026</code>. Manage staff in <a href="/admin" style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Master Admin</a>.</span>
                ) : (
                  <span>🔒 Fallback passcode configured in <code>.env.local</code> as <code>MANAGER_PASSCODE</code> (default: <code>paranjape2026</code>).</span>
                )}
              </div>
            </div>
          </div>

          {/* Self-Reset Modal */}
          {showResetModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>Reset Kitchen Manager Passcode</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 16px' }}>
                  Enter the Super Admin Recovery Key (default: <code>admin2026</code>) to define a new Kitchen Manager passcode.
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
                    <label style={{ fontSize: '0.85rem' }}>New Manager Passcode (min 4 chars)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. kitchen2026 or 8899"
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
                      style={{ padding: '8px 14px', fontSize: '0.85rem' }}
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
              {staffUser && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f8f9fa', padding: '6px 14px', borderRadius: '20px', fontSize: '0.84rem', border: '1px solid #e5e7eb', color: 'var(--text)' }}>
                  <span>👨‍🍳</span>
                  <span><strong>{staffUser.name}</strong></span>
                  <span style={{ padding: '2px 7px', borderRadius: '6px', background: staffUser.role === 'owner' ? '#7b1fa2' : 'var(--accent)', color: '#fff', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {staffUser.role}
                  </span>
                </div>
              )}

              <div className="tracker-live-pill">
                <span className="live-pulse-dot" />
                <span>{isLiveConnected ? 'Live Real-Time Sync' : 'Polling Sync'}</span>
              </div>

              <button
                type="button"
                className="manager-refresh-btn"
                onClick={openDailyReportModal}
                style={{ background: '#e6f5eb', color: '#01621f', borderColor: '#a3d9b4', fontWeight: 700 }}
                title="Generate end of day settlement & sales report"
              >
                📑 Daily Report
              </button>

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

          {/* Top Summary Stats Bar (Daily operational counters reset every midnight) */}
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
              <div className="stat-label">Cooking Now</div>
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
              <div className="stat-num" style={{ color: '#01621f' }}>{stats.deliveredToday}</div>
              <div className="stat-label">Delivered Today</div>
              <div style={{ fontSize: '0.68rem', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>Resets Midnight</div>
            </div>
            <div
              className={`manager-stat-card ${filter === 'today' ? 'active' : ''}`}
              onClick={() => setFilter('today')}
            >
              <div className="stat-num" style={{ color: '#01621f' }}>₹{stats.todayRevenue}</div>
              <div className="stat-label">Today&apos;s Revenue</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px' }}>₹{stats.todayUpi} UPI • ₹{stats.todayCash} Cash</div>
            </div>
          </div>

          {/* Segmented Filter Bar */}
          <div className="manager-filter-bar">
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active Kitchen <span className="manager-filter-badge">{stats.active}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'preparing' ? 'active' : ''}`}
              onClick={() => setFilter('preparing')}
            >
              👨‍🍳 Cooking <span className="manager-filter-badge">{stats.preparing}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'ready' ? 'active' : ''}`}
              onClick={() => setFilter('ready')}
            >
              📦 Ready <span className="manager-filter-badge">{stats.ready}</span>
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
              ✅ Delivered Today <span className="manager-filter-badge">{stats.deliveredToday}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'today' ? 'active' : ''}`}
              onClick={() => setFilter('today')}
            >
              📅 Today&apos;s All <span className="manager-filter-badge">{stats.todayTotal}</span>
            </button>
            <button
              type="button"
              className={`manager-filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              🗓️ All History <span className="manager-filter-badge">{stats.total}</span>
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
                        title="Preview customer live tracking view"
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <h5 style={{ margin: 0 }}>Delivery Destination</h5>
                        <button
                          type="button"
                          onClick={() => openEditAddressModal(order)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            textDecoration: 'underline',
                            padding: 0,
                          }}
                        >
                          ✏️ Edit Address
                        </button>
                      </div>
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

                  {/* Delivery Partner Assignment Section */}
                  <div
                    style={{
                      background: order.assignedRiderId ? '#f3faf5' : '#fdf8f0',
                      border: '1px solid',
                      borderColor: order.assignedRiderId ? '#a3d9b4' : '#f5dfb8',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      margin: '14px 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.35rem' }}>🛵</span>
                      <div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Delivery Assignment
                        </div>
                        {order.assignedRiderId ? (
                          <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#01621f' }}>
                            {order.assignedRiderId.name}
                            {order.assignedRiderId.vehicleNumber ? ` (${order.assignedRiderId.vehicleNumber})` : ''}
                            {order.assignedRiderId.phone ? ` • 📞 ${order.assignedRiderId.phone}` : ''}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: '#8c5800', fontWeight: '500' }}>
                            ⚠️ Unassigned (Open to all delivery partners)
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAssignModal(order)}
                      style={{
                        background: order.assignedRiderId ? '#ffffff' : 'var(--accent)',
                        color: order.assignedRiderId ? 'var(--text)' : '#ffffff',
                        border: order.assignedRiderId ? '1px solid #d1d5db' : 'none',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '0.82rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: order.assignedRiderId ? 'none' : '0 2px 8px rgba(236, 34, 39, 0.25)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {order.assignedRiderId ? '🔄 Change Rider' : '➕ Assign Rider'}
                    </button>
                  </div>

                  {/* Payment & Next Stage Action Stepper */}
                  <div className="manager-actions-row">
                    <div>
                      <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>Payment: </span>
                      <strong style={{ fontSize: '0.92rem', color: order.paymentMethod === 'razorpay' || order.orderStatus === 'delivered' ? '#01621f' : '#b06000' }}>
                        {order.paymentMethod === 'razorpay'
                          ? `✓ Paid Online via UPI (₹${order.totalAmount})`
                          : order.orderStatus === 'delivered'
                          ? `Cash/UPI Collected (₹${order.totalAmount})`
                          : `Collect Cash/UPI (₹${order.totalAmount})`}
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
                          🛵 Hand Over to Delivery Partner (Dispatch)
                        </button>
                      )}

                      {order.orderStatus === 'out_for_delivery' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              background: '#e8f0fe',
                              color: '#1a73e8',
                              borderRadius: '8px',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                            }}
                          >
                            🛵 In Transit with {order.assignedRiderId?.name || 'Rider'} — Rider marks Handed to Resident
                          </span>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `⚠️ Kitchen Override Notice:\n\nOrders out for delivery should normally be marked "Handed to Resident" by the delivery partner at the resident's doorstep.\n\nAre you sure you want to manually mark Order #PF-${order._id.slice(-6).toUpperCase()} as Handed to Resident?`
                                )
                              ) {
                                handleUpdateStatus(order._id, 'delivered');
                              }
                            }}
                            style={{
                              background: 'none',
                              border: '1px solid #d1d5db',
                              color: 'var(--muted)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                            }}
                            title="Only use if resident picked up directly from kitchen or delivery partner is offline"
                          >
                            Override: Mark Handed to Resident
                          </button>
                        </div>
                      )}

                      {order.orderStatus === 'delivered' && (
                        <span
                          style={{
                            color: '#01621f',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            padding: '6px 12px',
                            background: '#e6f5eb',
                            borderRadius: '8px',
                          }}
                        >
                          ✓ Handed to Resident (Completed)
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
                            color: '#ec2227',
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

          {/* Assign Delivery Rider Modal */}
          {assignModalOrder && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 12px 35px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🛵</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Assign Delivery Partner</h3>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: '0 0 18px', lineHeight: '1.45' }}>
                  Assign order <strong>#PF-{String(assignModalOrder._id).slice(-6).toUpperCase()}</strong> to a dedicated delivery fleet partner.
                </p>

                <form onSubmit={handleAssignRider}>
                  <div className="form-group" style={{ textAlign: 'left', marginBottom: '18px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                      Delivery Rider
                    </label>
                    <select
                      value={selectedRiderId}
                      onChange={(e) => setSelectedRiderId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid #d1d5db',
                        fontSize: '0.92rem',
                        outline: 'none',
                        background: '#faf8f5',
                      }}
                    >
                      <option value="">-- Unassigned (Open Pool) --</option>
                      {riders.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} {r.vehicleNumber ? `(${r.vehicleNumber})` : ''} • 📞 {r.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  {assignError && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '14px', background: '#fce8e6', color: '#c5221f' }}>
                      {assignError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button
                      type="button"
                      onClick={() => setAssignModalOrder(null)}
                      className="button-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                      disabled={assignSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="button"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      disabled={assignSubmitting}
                    >
                      {assignSubmitting ? 'Saving...' : selectedRiderId ? 'Confirm Assignment' : 'Unassign Rider'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {editingAddressOrder && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', padding: '26px', maxWidth: '480px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.25)' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>
                  ✏️ Edit Delivery Address (#PF-{String(editingAddressOrder._id).slice(-6).toUpperCase()})
                </h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: '0 0 18px' }}>
                  Customer: <strong>{editingAddressOrder.customerId?.name || 'Customer'}</strong> ({editingAddressOrder.customerId?.phone || '-'})
                </p>

                <form onSubmit={handleSaveAddress}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '10px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ margin: 0, textAlign: 'left' }}>
                      <label style={{ fontSize: '0.82rem' }}>Door / Flat No.</label>
                      <input
                        type="text"
                        value={editAddressForm.flatNo}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, flatNo: e.target.value })}
                        placeholder="e.g. Flat 402"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0, textAlign: 'left' }}>
                      <label style={{ fontSize: '0.82rem' }}>Building / Society</label>
                      <input
                        type="text"
                        required
                        value={editAddressForm.buildingName}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, buildingName: e.target.value })}
                        placeholder="e.g. Sunshine Apartments"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.82rem' }}>Street / Landmark / Area</label>
                    <input
                      type="text"
                      required
                      value={editAddressForm.street}
                      onChange={(e) => setEditAddressForm({ ...editAddressForm, street: e.target.value })}
                      placeholder="e.g. Near Goodluck Cafe, FC Road"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0, textAlign: 'left' }}>
                      <label style={{ fontSize: '0.82rem' }}>City</label>
                      <input
                        type="text"
                        required
                        value={editAddressForm.city}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, city: e.target.value })}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0, textAlign: 'left' }}>
                      <label style={{ fontSize: '0.82rem' }}>Pincode</label>
                      <input
                        type="text"
                        value={editAddressForm.zipCode}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, zipCode: e.target.value })}
                        placeholder="e.g. 411004"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                      />
                    </div>
                  </div>

                  {addressSaveError && (
                    <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '14px', background: '#fce8e6', color: '#c5221f' }}>
                      {addressSaveError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setEditingAddressOrder(null)}
                      className="button-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                      disabled={addressSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="button"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      disabled={addressSubmitting || !editAddressForm.buildingName || !editAddressForm.street}
                    >
                      {addressSubmitting ? 'Saving...' : 'Save & Broadcast Address'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL 3: KITCHEN DAILY SETTLEMENT & SALES REPORT */}
          {showReportModal && (
            <div className="admin-modal-backdrop" onClick={() => setShowReportModal(false)}>
              <div
                className="admin-modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '840px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '1.28rem' }}>
                      📑 Daily Kitchen Settlement Report
                    </h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.84rem' }}>
                      Reconcile cash collections, rider settlements, online UPI receipts, and item counts.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => {
                        setReportDate(e.target.value);
                        fetchDailyReport(e.target.value);
                      }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1.5px solid #d1d5db',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                      }}
                      title="Select date for report"
                    />
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="button-secondary"
                      style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                      title="Print or Save as PDF"
                    >
                      🖨️ Print PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleExportManagerCSV}
                      className="button"
                      style={{ background: '#01621f', borderColor: '#01621f', padding: '7px 12px', fontSize: '0.8rem' }}
                    >
                      📥 CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
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

                {reportLoading ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--muted)' }}>
                    <p>Generating daily audit calculations...</p>
                  </div>
                ) : reportData && reportData.summary ? (
                  <div>
                    {/* Summary Counters Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                      <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #a3d9b4' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Gross Revenue</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#01621f', marginTop: '2px' }}>₹{reportData.summary.totalRevenue || 0}</div>
                      </div>
                      <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Online UPI</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>₹{reportData.summary.upiRevenue || 0}</div>
                      </div>
                      <div style={{ padding: '12px', background: '#fef7e0', borderRadius: '10px', border: '1px solid #f9ab00' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cash Collected</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b06000', marginTop: '2px' }}>₹{reportData.summary.codRevenue || 0}</div>
                      </div>
                      <div style={{ padding: '12px', background: '#fff', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Orders Total</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginTop: '2px' }}>{reportData.summary.totalOrders || 0}</div>
                        <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>{reportData.summary.deliveredOrders || 0} delivered</div>
                      </div>
                    </div>

                    {/* Section 1: Fleet Settlement (Cash Hand-Off Table) */}
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.96rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🛵</span>
                        <span>Delivery Rider Cash Settlement (Hand-Off)</span>
                      </h4>
                      {reportData.riderSettlement && reportData.riderSettlement.length > 0 ? (
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                          <table className="admin-table" style={{ fontSize: '0.82rem' }}>
                            <thead>
                              <tr>
                                <th>Delivery Rider</th>
                                <th>Contact</th>
                                <th style={{ textAlign: 'center' }}>Completed</th>
                                <th style={{ textAlign: 'right' }}>Cash to Hand In (₹)</th>
                                <th style={{ textAlign: 'right' }}>Online Delivered (₹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportData.riderSettlement.map((rider, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 700 }}>{rider.name}</td>
                                  <td>{rider.phone || '-'}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span style={{ padding: '2px 8px', background: '#e6f5eb', color: '#01621f', borderRadius: '10px', fontWeight: 700 }}>
                                      {rider.deliveredCount}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#b06000', fontSize: '0.92rem' }}>
                                    ₹{rider.cashCollected || 0}
                                  </td>
                                  <td style={{ textAlign: 'right', color: '#2563eb' }}>
                                    ₹{rider.onlineDelivered || 0}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                          No fleet deliveries completed on this date.
                        </p>
                      )}
                    </div>

                    {/* Section 2: Dish Sales Count */}
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.96rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🍲</span>
                        <span>Dishes Sold Today</span>
                      </h4>
                      {reportData.topDishes && reportData.topDishes.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {reportData.topDishes.map((dish, idx) => (
                            <div key={idx} style={{ padding: '8px 12px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>{dish.title}</span>
                              <span style={{ fontWeight: 800, color: '#01621f', fontSize: '0.88rem' }}>× {dish.quantity} (₹{dish.revenue})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>No dishes sold on this date.</p>
                      )}
                    </div>

                    {/* Section 3: Orders List for Date */}
                    {reportData.timeline && reportData.timeline[0]?.orders && (
                      <div>
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.96rem', color: 'var(--text)' }}>
                          📜 Orders Ledger ({reportData.timeline[0].orders.length} orders)
                        </h4>
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                          <table className="admin-table" style={{ fontSize: '0.8rem' }}>
                            <thead>
                              <tr>
                                <th>Order &amp; Time</th>
                                <th>Customer</th>
                                <th>Dishes</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportData.timeline[0].orders.map((o) => (
                                <tr key={o._id}>
                                  <td>
                                    <div style={{ fontWeight: 800, color: 'var(--accent)' }}>#{o.shortId}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                      {new Date(o.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 600 }}>{o.customerName}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{o.customerPhone}</div>
                                  </td>
                                  <td style={{ maxWidth: '180px', fontSize: '0.76rem' }}>{o.dishesText}</td>
                                  <td>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        background: o.paymentMethod === 'razorpay' ? '#e6f5eb' : '#fef7e0',
                                        color: o.paymentMethod === 'razorpay' ? '#01621f' : '#b06000',
                                      }}
                                    >
                                      {o.paymentMethod === 'razorpay' ? 'UPI' : 'Cash'}
                                    </span>
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: o.orderStatus === 'delivered' ? '#e6f5eb' : '#eff6ff',
                                        color: o.orderStatus === 'delivered' ? '#01621f' : '#2563eb',
                                      }}
                                    >
                                      {o.orderStatus}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#01621f' }}>
                                    ₹{o.totalAmount}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                    No order records found for {reportDate}.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      )}
    </>
  );
}
