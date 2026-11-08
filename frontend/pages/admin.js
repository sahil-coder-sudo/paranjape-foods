import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

export default function AdminPortal() {
  const router = useRouter();

  // Authentication State
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'customers', 'credentials', 'reports'

  // Overview Data
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Reports & Historical Analytics Data
  const [reportPeriod, setReportPeriod] = useState('daily'); // 'daily' or 'monthly'
  const [reportMonth, setReportMonth] = useState(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);
  });
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedDayLedger, setSelectedDayLedger] = useState(null);

  // Customers Data
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Customer Password Reset Modal
  const [resetModalCustomer, setResetModalCustomer] = useState(null);
  const [newCustomerPassword, setNewCustomerPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState({ text: '', type: '' });

  // Staff Credentials Data
  const [credentials, setCredentials] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [staffModalRole, setStaffModalRole] = useState(null); // 'manager', 'delivery', 'admin'
  const [newStaffPasscode, setNewStaffPasscode] = useState('');
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffMessage, setStaffMessage] = useState({ text: '', type: '' });

  // Staff Users Directory State
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffUsersLoading, setStaffUsersLoading] = useState(false);

  // Add Staff Modal
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [addStaffForm, setAddStaffForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'manager',
    password: '',
    vehicleNumber: '',
  });
  const [addStaffSubmitting, setAddStaffSubmitting] = useState(false);
  const [addStaffError, setAddStaffError] = useState('');

  // Edit Staff Modal
  const [editingStaffUser, setEditingStaffUser] = useState(null);
  const [editStaffForm, setEditStaffForm] = useState({
    name: '',
    email: '',
    role: 'manager',
    vehicleNumber: '',
  });
  const [editStaffSubmitting, setEditStaffSubmitting] = useState(false);
  const [editStaffError, setEditStaffError] = useState('');

  // Reset Individual Staff Password / PIN Modal
  const [resetStaffUser, setResetStaffUser] = useState(null);
  const [newStaffUserPassword, setNewStaffUserPassword] = useState('');
  const [resetStaffSubmitting, setResetStaffSubmitting] = useState(false);
  const [resetStaffMessage, setResetStaffMessage] = useState({ text: '', type: '' });
  const [staffSubFilter, setStaffSubFilter] = useState('all'); // 'all' | 'managers' | 'riders' | 'fallbacks'

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  // 1. Check existing session on mount
  useEffect(() => {
    const savedToken =
      (typeof window !== 'undefined' &&
        (localStorage.getItem('pf_admin_token') || sessionStorage.getItem('pf_admin_token'))) ||
      null;

    if (!savedToken) {
      setAuthChecking(false);
      return;
    }

    fetch(`${API_BASE}/api/admin/auth/check-master`, {
      headers: { 'x-admin-token': savedToken },
    })
      .then((res) => {
        if (res.ok) {
          setToken(savedToken);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('pf_admin_token');
          sessionStorage.removeItem('pf_admin_token');
          setIsAuthenticated(false);
        }
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setAuthChecking(false));
  }, []);

  // 2. Fetch data when authenticated or active tab changes
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    if (activeTab === 'overview') {
      fetchOverview();
    } else if (activeTab === 'customers') {
      fetchCustomers();
    } else if (activeTab === 'credentials') {
      fetchStaffUsers();
      fetchCredentials();
    } else if (activeTab === 'reports') {
      fetchReports();
    }
  }, [isAuthenticated, token, activeTab, reportPeriod, reportMonth]);

  const fetchReports = async (period = reportPeriod, month = reportMonth) => {
    setReportLoading(true);
    try {
      const url = new URL(`${API_BASE}/api/admin/reports`);
      url.searchParams.set('period', period);
      if (period === 'daily' && month) {
        url.searchParams.set('month', month);
      }
      const res = await fetch(url.toString(), {
        headers: { 'x-admin-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData || !reportData.timeline || reportData.timeline.length === 0) {
      alert('No data available to export.');
      return;
    }

    const isMonthly = reportPeriod === 'monthly';
    const headers = isMonthly
      ? ['Month', 'Total Orders', 'Delivered Orders', 'Online UPI (INR)', 'Cash on Delivery (INR)', 'Gross Revenue (INR)', 'Avg Order Value (INR)']
      : ['Date', 'Day', 'Total Orders', 'Delivered', 'Cancelled', 'Active', 'Online UPI (INR)', 'Cash on Delivery (INR)', 'Total Revenue (INR)', 'Top Dish Sold'];

    const rows = reportData.timeline.map((entry) => {
      if (isMonthly) {
        return [
          `"${entry.label || entry.key}"`,
          entry.ordersCount || 0,
          entry.deliveredCount || 0,
          entry.upiRevenue || 0,
          entry.codRevenue || 0,
          entry.totalRevenue || 0,
          entry.avgOrderValue || 0,
        ];
      }
      return [
        `"${entry.key}"`,
        `"${entry.label}"`,
        entry.ordersCount || 0,
        entry.deliveredCount || 0,
        entry.cancelledCount || 0,
        entry.activeCount || 0,
        entry.upiRevenue || 0,
        entry.codRevenue || 0,
        entry.totalRevenue || 0,
        `"${(entry.topDish || '-').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `ParanjapeFoods_${reportPeriod === 'monthly' ? 'Monthly_Report' : `Daily_Report_${reportMonth}`}_${Date.now()}.csv`;

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

  const handleExportDayCSV = (dayEntry) => {
    if (!dayEntry || !dayEntry.orders || dayEntry.orders.length === 0) {
      alert('No orders in this day ledger.');
      return;
    }

    const headers = [
      'Order ID',
      'Time (IST)',
      'Customer Name',
      'Customer Phone',
      'Delivery Address',
      'Dishes Ordered',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Assigned Delivery Partner',
      'Total Amount (INR)',
    ];

    const rows = dayEntry.orders.map((o) => [
      `"#${o.shortId}"`,
      `"${new Date(o.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}"`,
      `"${(o.customerName || 'Customer').replace(/"/g, '""')}"`,
      `"${o.customerPhone || '-'}"`,
      `"${(o.addressSummary || '-').replace(/"/g, '""')}"`,
      `"${(o.dishesText || '-').replace(/"/g, '""')}"`,
      `"${o.paymentMethod === 'razorpay' ? 'Online UPI (Razorpay)' : 'Cash / UPI on Delivery'}"`,
      `"${o.paymentStatus || 'pending'}"`,
      `"${o.orderStatus}"`,
      `"${(o.riderName || 'Unassigned').replace(/"/g, '""')}"`,
      o.totalAmount || 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `ParanjapeFoods_DayLedger_${dayEntry.key}.csv`;

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

  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/overview`, {
        headers: { 'x-admin-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error('Failed to load overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  const fetchCustomers = async (search = customerSearch) => {
    setCustomersLoading(true);
    try {
      const url = new URL(`${API_BASE}/api/admin/customers`);
      if (search) url.searchParams.set('search', search);

      const res = await fetch(url.toString(), {
        headers: { 'x-admin-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setCustomersLoading(false);
    }
  };

  const fetchCredentials = async () => {
    setCredentialsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-credentials`, {
        headers: { 'x-admin-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
    } finally {
      setCredentialsLoading(false);
    }
  };

  const fetchStaffUsers = async () => {
    setStaffUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-users`, {
        headers: { 'x-admin-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setStaffUsers(data);
      }
    } catch (err) {
      console.error('Failed to load staff users:', err);
    } finally {
      setStaffUsersLoading(false);
    }
  };

  const handleCreateStaffUser = async (e) => {
    e.preventDefault();
    setAddStaffSubmitting(true);
    setAddStaffError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(addStaffForm),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowAddStaffModal(false);
        setAddStaffForm({
          name: '',
          phone: '',
          email: '',
          role: 'manager',
          password: '',
          vehicleNumber: '',
        });
        fetchStaffUsers();
      } else {
        setAddStaffError(data.error || 'Failed to create staff member.');
      }
    } catch (err) {
      setAddStaffError('Network error creating staff member.');
    } finally {
      setAddStaffSubmitting(false);
    }
  };

  const handleToggleStaffActive = async (staffId, currentStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-users/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        setStaffUsers((prev) =>
          prev.map((s) => (s._id === staffId ? { ...s, isActive: !currentStatus } : s))
        );
      }
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleEditStaffUser = async (e) => {
    e.preventDefault();
    if (!editingStaffUser) return;
    setEditStaffSubmitting(true);
    setEditStaffError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-users/${editingStaffUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(editStaffForm),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEditingStaffUser(null);
        fetchStaffUsers();
      } else {
        setEditStaffError(data.error || 'Failed to update staff member.');
      }
    } catch (err) {
      setEditStaffError('Network error updating staff member.');
    } finally {
      setEditStaffSubmitting(false);
    }
  };

  const handleResetStaffPassword = async (e) => {
    e.preventDefault();
    if (!resetStaffUser || !newStaffUserPassword) return;

    setResetStaffSubmitting(true);
    setResetStaffMessage({ text: '', type: '' });

    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-users/${resetStaffUser._id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({ newPassword: newStaffUserPassword.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setResetStaffMessage({ text: data.message || 'Password reset successfully!', type: 'success' });
        setTimeout(() => {
          setResetStaffUser(null);
          setNewStaffUserPassword('');
          setResetStaffMessage({ text: '', type: '' });
        }, 1800);
      } else {
        setResetStaffMessage({ text: data.error || 'Failed to reset password.', type: 'error' });
      }
    } catch (err) {
      setResetStaffMessage({ text: 'Network error resetting password.', type: 'error' });
    } finally {
      setResetStaffSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (!window.confirm(`Are you sure you want to remove staff member "${staff.name}" (${staff.phone})?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-users/${staff._id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      });
      if (res.ok) {
        setStaffUsers((prev) => prev.filter((s) => s._id !== staff._id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete staff member.');
      }
    } catch (err) {
      alert('Network error deleting staff member.');
    }
  };

  // 3. Handle Admin Login
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/admin/master-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.token) {
        setAuthError(data.error || 'Invalid master admin passcode.');
        return;
      }

      localStorage.setItem('pf_admin_token', data.token);
      setToken(data.token);
      setIsAuthenticated(true);
      setPasscode('');
    } catch (err) {
      setAuthError('Unable to connect to the authentication service.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pf_admin_token');
    sessionStorage.removeItem('pf_admin_token');
    setToken(null);
    setIsAuthenticated(false);
  };

  // 4. Handle Customer Password Reset
  const handleCustomerPasswordReset = async (e) => {
    e.preventDefault();
    if (!resetModalCustomer || !newCustomerPassword) return;

    setResetSubmitting(true);
    setResetMessage({ text: '', type: '' });

    try {
      const res = await fetch(`${API_BASE}/api/admin/customers/${resetModalCustomer._id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({ newPassword: newCustomerPassword.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setResetMessage({ text: data.message || 'Password updated successfully!', type: 'success' });
        setTimeout(() => {
          setResetModalCustomer(null);
          setNewCustomerPassword('');
          setResetMessage({ text: '', type: '' });
        }, 1800);
      } else {
        setResetMessage({ text: data.error || 'Failed to update customer password.', type: 'error' });
      }
    } catch (err) {
      setResetMessage({ text: 'Network error updating password.', type: 'error' });
    } finally {
      setResetSubmitting(false);
    }
  };

  // 5. Handle Staff Passcode Reset
  const handleStaffPasscodeReset = async (e) => {
    e.preventDefault();
    if (!staffModalRole || !newStaffPasscode) return;

    setStaffSubmitting(true);
    setStaffMessage({ text: '', type: '' });

    try {
      const res = await fetch(`${API_BASE}/api/admin/staff-credentials/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({
          role: staffModalRole,
          newPasscode: newStaffPasscode.trim(),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStaffMessage({ text: data.message || 'Passcode updated successfully!', type: 'success' });
        fetchCredentials();
        setTimeout(() => {
          setStaffModalRole(null);
          setNewStaffPasscode('');
          setStaffMessage({ text: '', type: '' });
        }, 1800);
      } else {
        setStaffMessage({ text: data.error || 'Failed to update passcode.', type: 'error' });
      }
    } catch (err) {
      setStaffMessage({ text: 'Network error updating staff passcode.', type: 'error' });
    } finally {
      setStaffSubmitting(false);
    }
  };

  // Loading Screen
  if (authChecking) {
    return (
      <main className="page" style={{ maxWidth: '520px', margin: '0 auto', padding: '80px 20px' }}>
        <NavBar />
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '40px' }}>
          <div
            className="live-pulse-dot"
            style={{
              margin: '0 auto 16px',
              width: '14px',
              height: '14px',
              background: '#b72a2a',
            }}
          />
          <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: 0 }}>Verifying Administrator Credentials...</p>
        </div>
      </main>
    );
  }

  // Lock Screen (Unauthenticated View)
  if (!isAuthenticated) {
    return (
      <>
        <Head>
          <title>Master Admin Portal | Paranjape Foods</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <NavBar />

        <main className="page" style={{ maxWidth: '480px', margin: '0 auto', padding: '30px 16px 80px' }}>
          <div className="manager-auth-wrapper" style={{ minHeight: 'auto', padding: '20px 0' }}>
            <div className="manager-auth-card">
              <div
                className="manager-lock-icon-circle"
                style={{
                  background: 'linear-gradient(135deg, rgba(183, 42, 42, 0.12) 0%, rgba(183, 42, 42, 0.04) 100%)',
                  color: '#b72a2a',
                  borderColor: 'rgba(183, 42, 42, 0.25)',
                }}
              >
                <span style={{ fontSize: '1.8rem' }}>🛡️</span>
              </div>

              <span className="admin-badge">Super Admin Clearance</span>
              <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.9rem', margin: '0 0 6px' }}>Master Admin Portal</h2>
              <p className="manager-auth-desc">
                Enter your administrative master security passcode to access user records, order analytics, and staff credential controls.
              </p>

              {authError && (
                <div className="error-message" style={{ margin: '0 0 18px', textAlign: 'left' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                <div className="manager-passcode-field">
                  <label htmlFor="adminPasscodeInput">Admin Master Passcode</label>
                  <div className="manager-input-container">
                    <input
                      id="adminPasscodeInput"
                      type={showPasscode ? 'text' : 'password'}
                      required
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter master admin passcode"
                      className="manager-passcode-input"
                      autoFocus
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

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="manager-auth-btn"
                  style={{ background: '#b72a2a', boxShadow: '0 4px 14px rgba(183, 42, 42, 0.28)' }}
                >
                  {authSubmitting ? 'Authenticating...' : 'Unlock Admin Portal 🛡️ →'}
                </button>
              </form>

              <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'center', gap: '14px' }}>
                <button
                  type="button"
                  onClick={() => router.push('/manager')}
                  style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', padding: '6px 14px', borderRadius: '16px', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                >
                  🍳 Kitchen Board →
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/delivery')}
                  style={{ background: '#e6f5eb', border: '1px solid #a3d9b4', padding: '6px 14px', borderRadius: '16px', color: '#01621f', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                >
                  🛵 Delivery App →
                </button>
              </div>

              <div className="manager-auth-hint-box" style={{ marginTop: '18px' }}>
                🔒 Master Admin key is configured as <code>admin2026</code>.
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Filtered lists for Tab 3
  const managerStaffList = staffUsers.filter((s) => ['owner', 'manager'].includes(s.role));
  const riderStaffList = staffUsers.filter((s) => s.role === 'delivery');

  return (
    <>
      <Head>
        <title>Master Administrator Dashboard | Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <NavBar />

      <main className="admin-container">
        {/* Top Header Card */}
        <div className="admin-header-card">
          <div>
            <div className="admin-badge">
              <span>🛡️</span>
              <span>Super Admin Master Console</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.95rem', margin: '0 0 6px', color: 'var(--text)' }}>
              Administrative Operations Dashboard
            </h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem', lineHeight: '1.45' }}>
              Real-time user directory, order overview, and secure staff credential controls.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/manager')}
              className="button-secondary"
              style={{ padding: '9px 15px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>🍳</span> Kitchen Board
            </button>
            <button
              onClick={() => router.push('/delivery')}
              className="button-secondary"
              style={{ padding: '9px 15px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>🛵</span> Delivery Fleet
            </button>
            <button
              onClick={handleLogout}
              style={{
                background: '#fce8e6',
                color: '#c5221f',
                border: '1px solid #fad2cf',
                borderRadius: '10px',
                padding: '9px 16px',
                fontSize: '0.86rem',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.15s ease',
              }}
            >
              🔒 Lock Portal
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="admin-tab-nav">
          <button
            onClick={() => setActiveTab('overview')}
            className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <span>📊</span>
            <span>System Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`admin-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          >
            <span>📈</span>
            <span>Reports &amp; Past Totals</span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`admin-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          >
            <span>👥</span>
            <span>Customer Directory</span>
            <span className="admin-tab-badge">{customers.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`admin-tab-btn ${activeTab === 'credentials' ? 'active' : ''}`}
          >
            <span>🔐</span>
            <span>Staff &amp; Fleet Directory</span>
            <span className="admin-tab-badge">{staffUsers.length}</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: SYSTEM OVERVIEW
           ========================================================================= */}
        {activeTab === 'overview' && (
          <div>
            {overviewLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                <p>Loading administrative metrics...</p>
              </div>
            ) : overview ? (
              <div>
                {/* Today's Live Operational Counters (Resets Every Midnight) */}
                <div style={{ background: '#f0fdf4', border: '1.5px solid #a3d9b4', borderRadius: '18px', padding: '20px 24px', marginBottom: '24px', boxShadow: '0 4px 16px rgba(1, 98, 31, 0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>⚡</span>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#01621f', fontWeight: 800 }}>
                        Today&apos;s Live Operations ({overview.today?.date || 'Today'})
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.74rem', background: '#e6f5eb', color: '#01621f', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, border: '1px solid #a3d9b4' }}>
                      Resets Daily at Midnight (IST)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Today&apos;s Revenue</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#01621f', marginTop: '4px' }}>₹{overview.today?.revenue || 0}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '2px' }}>₹{overview.today?.upiRevenue || 0} UPI • ₹{overview.today?.codRevenue || 0} Cash</div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Today&apos;s Orders</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent)', marginTop: '4px' }}>{overview.today?.ordersCount || 0}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '2px' }}>Placed today</div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Delivered Today</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{overview.today?.deliveredCount || 0}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '2px' }}>Handed to residents</div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #dcfce7' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Online UPI Share</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                        {overview.today?.revenue > 0 ? Math.round(((overview.today?.upiRevenue || 0) / overview.today.revenue) * 100) : 0}%
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '2px' }}>Automated Razorpay</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    All-Time Lifetime Totals
                  </h4>
                </div>

                {/* 4 Metric Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px', marginBottom: '28px' }}>
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross Revenue</span>
                      <span style={{ fontSize: '1.4rem' }}>💰</span>
                    </div>
                    <div style={{ fontSize: '2.1rem', fontWeight: 'bold', color: '#01621f', marginTop: '8px' }}>₹{overview.totalRevenue || 0}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>All successful delivered orders</div>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Orders</span>
                      <span style={{ fontSize: '1.4rem' }}>📦</span>
                    </div>
                    <div style={{ fontSize: '2.1rem', fontWeight: 'bold', color: 'var(--accent)', marginTop: '8px' }}>{overview.totalOrders || 0}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>In kitchen, transit &amp; delivered</div>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customers</span>
                      <span style={{ fontSize: '1.4rem' }}>👥</span>
                    </div>
                    <div style={{ fontSize: '2.1rem', fontWeight: 'bold', color: '#1a73e8', marginTop: '8px' }}>{overview.totalCustomers || 0}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>Registered customer accounts</div>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Menu Items</span>
                      <span style={{ fontSize: '1.4rem' }}>🍲</span>
                    </div>
                    <div style={{ fontSize: '2.1rem', fontWeight: 'bold', color: '#d97706', marginTop: '8px' }}>{overview.totalMenuItems || 0}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>Active offerings in kitchen catalog</div>
                  </div>
                </div>

                {/* Live Order Pipeline Tracker */}
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '18px', padding: '24px 28px', marginBottom: '28px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Live Order Pipeline</h3>
                    <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>Real-time status across restaurant</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '14px 16px', background: '#fef7e0', borderRadius: '12px', border: '1px solid #f9ab00' }}>
                      <div style={{ fontSize: '0.78rem', color: '#8c5800', fontWeight: 'bold', textTransform: 'uppercase' }}>Placed / New</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#b06000', marginTop: '4px' }}>{overview.statusCounts?.placed || 0}</div>
                    </div>
                    <div style={{ padding: '14px 16px', background: '#e8f0fe', borderRadius: '12px', border: '1px solid #1a73e8' }}>
                      <div style={{ fontSize: '0.78rem', color: '#174ea6', fontWeight: 'bold', textTransform: 'uppercase' }}>Preparing in Kitchen</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#1a73e8', marginTop: '4px' }}>{overview.statusCounts?.preparing || 0}</div>
                    </div>
                    <div style={{ padding: '14px 16px', background: '#f3e8fd', borderRadius: '12px', border: '1px solid #a142f4' }}>
                      <div style={{ fontSize: '0.78rem', color: '#681da8', fontWeight: 'bold', textTransform: 'uppercase' }}>Ready for Pickup</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#7b1fa2', marginTop: '4px' }}>{overview.statusCounts?.ready || 0}</div>
                    </div>
                    <div style={{ padding: '14px 16px', background: '#feefe3', borderRadius: '12px', border: '1px solid #fa7b17' }}>
                      <div style={{ fontSize: '0.78rem', color: '#a53600', fontWeight: 'bold', textTransform: 'uppercase' }}>Out for Delivery</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#d95300', marginTop: '4px' }}>{overview.statusCounts?.out_for_delivery || 0}</div>
                    </div>
                    <div style={{ padding: '14px 16px', background: '#e6f5eb', borderRadius: '12px', border: '1px solid #01621f' }}>
                      <div style={{ fontSize: '0.78rem', color: '#0d652d', fontWeight: 'bold', textTransform: 'uppercase' }}>Delivered</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#01621f', marginTop: '4px' }}>{overview.statusCounts?.delivered || 0}</div>
                    </div>
                  </div>
                </div>

                {/* Recent Orders Table Card */}
                <div className="admin-table-card">
                  <div className="admin-table-card-header">
                    <div>
                      <h3 style={{ margin: '0 0 2px', fontSize: '1.15rem' }}>Recent Order Activity</h3>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.84rem' }}>Latest orders received through website</p>
                    </div>
                    <button
                      onClick={fetchOverview}
                      className="button-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  {overview.recentOrders && overview.recentOrders.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Total Amount</th>
                            <th>Order Status</th>
                            <th>Placed At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.recentOrders.map((ord) => (
                            <tr key={ord._id}>
                              <td style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent)' }}>
                                #PF-{String(ord._id).slice(-6).toUpperCase()}
                              </td>
                              <td>
                                <div style={{ fontWeight: '600' }}>{ord.customerId?.name || 'Guest User'}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{ord.customerId?.phone || '-'}</div>
                              </td>
                              <td style={{ fontWeight: 'bold', color: 'var(--text)' }}>
                                ₹{ord.totalAmount}
                              </td>
                              <td>
                                <span
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    background: ord.orderStatus === 'delivered' ? '#e6f5eb' : '#e8f0fe',
                                    color: ord.orderStatus === 'delivered' ? '#01621f' : '#1a73e8',
                                  }}
                                >
                                  {ord.orderStatus}
                                </span>
                              </td>
                              <td style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>
                                {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
                      <p style={{ margin: 0 }}>No orders recorded yet. Fresh customer orders will stream here instantly.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* =========================================================================
            TAB 2: CUSTOMER ACCOUNTS & PASSWORD RESET
           ========================================================================= */}
        {activeTab === 'customers' && (
          <div>
            {/* Search Header Card */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '18px', padding: '20px 24px', marginBottom: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search by customer name, 10-digit mobile number, or email..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      fetchCustomers(e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      border: '1.5px solid #d1d5db',
                      fontSize: '0.95rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <button
                  onClick={() => fetchCustomers(customerSearch)}
                  className="button"
                  style={{ padding: '12px 24px', fontSize: '0.9rem' }}
                >
                  🔍 Search
                </button>
                {customerSearch && (
                  <button
                    onClick={() => {
                      setCustomerSearch('');
                      fetchCustomers('');
                    }}
                    className="button-secondary"
                    style={{ padding: '12px 18px', fontSize: '0.9rem' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.84rem', color: 'var(--muted)' }}>
                Showing {customers.length} registered customer accounts in MongoDB database.
              </div>
            </div>

            {/* Customers Table Card */}
            <div className="admin-table-card">
              <div className="admin-table-card-header">
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: '1.15rem' }}>Registered Customers</h3>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.84rem' }}>
                    View accounts, verify registration type, and reset customer passwords on request.
                  </p>
                </div>
                <button
                  onClick={() => fetchCustomers(customerSearch)}
                  className="button-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                >
                  🔄 Refresh
                </button>
              </div>

              {customersLoading ? (
                <div style={{ padding: '50px', textAlign: 'center', color: 'var(--muted)' }}>
                  <p>Searching registered customers...</p>
                </div>
              ) : customers.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Mobile Number</th>
                        <th>Email</th>
                        <th>Sign-In Method</th>
                        <th>Orders Placed</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c._id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #ec2227 0%, #ed2d24 100%)',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  fontSize: '0.85rem',
                                  flexShrink: 0,
                                }}
                              >
                                {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                              </div>
                              <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>{c.name}</div>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                            {c.phone || '-'}
                          </td>
                          <td style={{ color: 'var(--muted)' }}>
                            {c.email || '-'}
                          </td>
                          <td>
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: '6px',
                                fontSize: '0.76rem',
                                fontWeight: '600',
                                background: c.authProvider === 'google' ? '#e8f0fe' : '#fef3e2',
                                color: c.authProvider === 'google' ? '#1a73e8' : '#8c5800',
                                border: c.authProvider === 'google' ? '1px solid #c2e7ff' : '1px solid #ffe7a3',
                              }}
                            >
                              {c.authProvider === 'google' ? '🌐 Google SSO' : '📱 Phone + Password'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 'bold' }}>
                            {c.orderCount || 0}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setResetModalCustomer(c);
                                setNewCustomerPassword('');
                                setResetMessage({ text: '', type: '' });
                              }}
                              style={{
                                background: '#fff',
                                border: '1px solid var(--accent)',
                                color: 'var(--accent)',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              🔑 Reset Password
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                  <span style={{ fontSize: '2rem' }}>👥</span>
                  <p style={{ margin: '10px 0 0', fontSize: '0.95rem' }}>
                    {customerSearch
                      ? 'No customers match your search query.'
                      : 'No registered customers yet (customer data was cleanly reset). New signups will appear here instantly.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: STAFF & FLEET DIRECTORY
           ========================================================================= */}
        {activeTab === 'credentials' && (
          <div>
            {/* Tab Header Card */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '18px', padding: '24px 28px', marginBottom: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>Staff &amp; Fleet Directory</h3>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                    Maintain separate database accounts for Kitchen Managers, Restaurant Owners, and Delivery Fleet Riders.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      fetchStaffUsers();
                      fetchCredentials();
                    }}
                    className="button-secondary"
                    style={{ padding: '10px 18px', fontSize: '0.88rem' }}
                  >
                    🔄 Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddStaffForm({
                        name: '',
                        phone: '',
                        email: '',
                        role: 'manager',
                        password: '',
                        vehicleNumber: '',
                      });
                      setAddStaffError('');
                      setShowAddStaffModal(true);
                    }}
                    className="button"
                    style={{ padding: '10px 20px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span>➕ Add Staff Member</span>
                  </button>
                </div>
              </div>

              {/* Sub-filter chips */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setStaffSubFilter('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: staffSubFilter === 'all' ? 'var(--accent)' : '#d1d5db',
                    background: staffSubFilter === 'all' ? '#fdf3ef' : '#fff',
                    color: staffSubFilter === 'all' ? 'var(--accent)' : 'var(--muted)',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  All Staff ({staffUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStaffSubFilter('managers')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: staffSubFilter === 'managers' ? 'var(--accent)' : '#d1d5db',
                    background: staffSubFilter === 'managers' ? '#fdf3ef' : '#fff',
                    color: staffSubFilter === 'managers' ? 'var(--accent)' : 'var(--muted)',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🍳 Kitchen Managers &amp; Owners ({managerStaffList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStaffSubFilter('riders')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: staffSubFilter === 'riders' ? '#01621f' : '#d1d5db',
                    background: staffSubFilter === 'riders' ? '#e6f5eb' : '#fff',
                    color: staffSubFilter === 'riders' ? '#01621f' : 'var(--muted)',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🛵 Delivery Fleet ({riderStaffList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStaffSubFilter('fallbacks')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: staffSubFilter === 'fallbacks' ? '#b72a2a' : '#d1d5db',
                    background: staffSubFilter === 'fallbacks' ? '#fce8e6' : '#fff',
                    color: staffSubFilter === 'fallbacks' ? '#b72a2a' : 'var(--muted)',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🛡️ Master &amp; Fallback Keys
                </button>
              </div>
            </div>

            {/* SECTION 1: KITCHEN MANAGERS & RESTAURANT OWNERS */}
            {['all', 'managers'].includes(staffSubFilter) && (
              <div className="admin-table-card">
                <div className="admin-table-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>🍳</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.15rem' }}>Kitchen Managers &amp; Restaurant Owners</h4>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Staff authorized to dispatch orders and manage kitchen preparation at <code>/manager</code>
                      </p>
                    </div>
                  </div>
                  <span style={{ background: '#f8f9fa', color: 'var(--accent)', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                    {managerStaffList.length} accounts
                  </span>
                </div>

                {staffUsersLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                    <p>Loading manager accounts...</p>
                  </div>
                ) : managerStaffList.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Staff Member</th>
                          <th>Login Mobile</th>
                          <th>Role</th>
                          <th>Account Status</th>
                          <th>Last Login</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {managerStaffList.map((staff) => (
                          <tr key={staff._id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: staff.role === 'owner' ? '#7b1fa2' : '#ec2227',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  {staff.role === 'owner' ? '👑' : '👨‍🍳'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>{staff.name}</div>
                                  {staff.email && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{staff.email}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: '600', letterSpacing: '0.5px' }}>
                              {staff.phone}
                            </td>
                            <td>
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.76rem',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  background: staff.role === 'owner' ? '#f3e8fd' : '#fdf3ef',
                                  color: staff.role === 'owner' ? '#7b1fa2' : 'var(--accent)',
                                  border: staff.role === 'owner' ? '1px solid #e1bee7' : '1px solid rgba(236, 34, 39, 0.2)',
                                }}
                              >
                                {staff.role === 'owner' ? '👑 Owner' : '👨‍🍳 Manager'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleToggleStaffActive(staff._id, staff.isActive)}
                                title={staff.isActive ? 'Click to deactivate staff member' : 'Click to activate staff member'}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontSize: '0.76rem',
                                  fontWeight: 'bold',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: staff.isActive ? '#e6f5eb' : '#fce8e6',
                                  color: staff.isActive ? '#01621f' : '#c5221f',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {staff.isActive ? '● Active' : '○ Inactive'}
                              </button>
                            </td>
                            <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                              {staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleString() : 'Never logged in'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStaffUser(staff);
                                    setEditStaffForm({
                                      name: staff.name,
                                      email: staff.email || '',
                                      role: staff.role,
                                      vehicleNumber: staff.vehicleNumber || '',
                                    });
                                    setEditStaffError('');
                                  }}
                                  className="button-secondary"
                                  style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetStaffUser(staff);
                                    setNewStaffUserPassword('');
                                    setResetStaffMessage({ text: '', type: '' });
                                  }}
                                  style={{
                                    background: '#fff',
                                    border: '1px solid var(--accent)',
                                    color: 'var(--accent)',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                  }}
                                >
                                  🔑 Reset Pass
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaff(staff)}
                                  title="Delete staff member"
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #fad2cf',
                                    color: '#c5221f',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                    <p style={{ margin: 0 }}>No manager accounts found. Click &quot;Add Staff Member&quot; to create one.</p>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: DELIVERY FLEET PARTNERS */}
            {['all', 'riders'].includes(staffSubFilter) && (
              <div className="admin-table-card">
                <div className="admin-table-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>🛵</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.15rem' }}>Delivery Fleet Partners</h4>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Delivery personnel authorized to accept orders and navigate destinations at <code>/delivery</code>
                      </p>
                    </div>
                  </div>
                  <span style={{ background: '#e6f5eb', color: '#01621f', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                    {riderStaffList.length} riders
                  </span>
                </div>

                {staffUsersLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                    <p>Loading delivery riders...</p>
                  </div>
                ) : riderStaffList.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Rider Name</th>
                          <th>Login Mobile</th>
                          <th>Vehicle / Bike Reg</th>
                          <th>Duty Status</th>
                          <th>Account Status</th>
                          <th>Last Login</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riderStaffList.map((rider) => (
                          <tr key={rider._id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: '#01621f',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  🛵
                                </div>
                                <div>
                                  <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>{rider.name}</div>
                                  {rider.email && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{rider.email}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: '600', letterSpacing: '0.5px' }}>
                              {rider.phone}
                            </td>
                            <td>
                              {rider.vehicleNumber ? (
                                <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#eef3fc', color: '#1a73e8', fontWeight: 'bold', fontSize: '0.78rem' }}>
                                  {rider.vehicleNumber}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>-</span>
                              )}
                            </td>
                            <td>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.76rem',
                                  fontWeight: '600',
                                  background: rider.currentStatus === 'on_delivery' ? '#fef7e0' : rider.currentStatus === 'available' ? '#e6f5eb' : '#f1f3f4',
                                  color: rider.currentStatus === 'on_delivery' ? '#b06000' : rider.currentStatus === 'available' ? '#01621f' : '#5f6368',
                                }}
                              >
                                {rider.currentStatus === 'on_delivery' ? 'On Delivery' : rider.currentStatus === 'available' ? 'Available' : 'Offline'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleToggleStaffActive(rider._id, rider.isActive)}
                                title={rider.isActive ? 'Click to deactivate rider' : 'Click to activate rider'}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontSize: '0.76rem',
                                  fontWeight: 'bold',
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: rider.isActive ? '#e6f5eb' : '#fce8e6',
                                  color: rider.isActive ? '#01621f' : '#c5221f',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {rider.isActive ? '● Active' : '○ Inactive'}
                              </button>
                            </td>
                            <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                              {rider.lastLoginAt ? new Date(rider.lastLoginAt).toLocaleString() : 'Never logged in'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStaffUser(rider);
                                    setEditStaffForm({
                                      name: rider.name,
                                      email: rider.email || '',
                                      role: rider.role,
                                      vehicleNumber: rider.vehicleNumber || '',
                                    });
                                    setEditStaffError('');
                                  }}
                                  className="button-secondary"
                                  style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetStaffUser(rider);
                                    setNewStaffUserPassword('');
                                    setResetStaffMessage({ text: '', type: '' });
                                  }}
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #01621f',
                                    color: '#01621f',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                  }}
                                >
                                  🔑 Reset PIN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaff(rider)}
                                  title="Delete rider"
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #fad2cf',
                                    color: '#c5221f',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                    <p style={{ margin: 0 }}>No riders found. Click &quot;Add Staff Member&quot; to create one.</p>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: SYSTEM PASSCODE & EMERGENCY FALLBACK CONTROLS */}
            {['all', 'fallbacks'].includes(staffSubFilter) && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '18px', padding: '24px 28px', marginTop: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div style={{ marginBottom: '18px' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1.18rem' }}>🛡️ Master Passcode &amp; System Fallback Controls</h4>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
                    System-level passcodes for emergency recovery and portal overrides. Hashed with bcrypt in MongoDB.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
                  {/* Kitchen Manager Fallback Card */}
                  <div style={{ background: '#faf8f5', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.4rem' }}>🍳</span>
                      <span style={{ background: '#e6f5eb', color: '#01621f', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold' }}>FALLBACK</span>
                    </div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>Manager Fallback Passcode</h4>
                    <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '0 0 14px' }}>
                      Quick passcode for Kitchen Board (default: <code>paranjape2026</code>).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffModalRole('manager');
                        setNewStaffPasscode('');
                        setStaffMessage({ text: '', type: '' });
                      }}
                      className="button-secondary"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '0.84rem', padding: '9px' }}
                    >
                      Change Manager Passcode
                    </button>
                  </div>

                  {/* Delivery Rider Fallback Card */}
                  <div style={{ background: '#faf8f5', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.4rem' }}>🛵</span>
                      <span style={{ background: '#e6f5eb', color: '#01621f', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold' }}>FALLBACK</span>
                    </div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>Rider Fallback Passcode</h4>
                    <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '0 0 14px' }}>
                      Quick passcode for Rider App (default: <code>rider2026</code>).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffModalRole('delivery');
                        setNewStaffPasscode('');
                        setStaffMessage({ text: '', type: '' });
                      }}
                      className="button-secondary"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '0.84rem', padding: '9px' }}
                    >
                      Change Rider Passcode
                    </button>
                  </div>

                  {/* Super Admin Master Passcode Card */}
                  <div style={{ background: '#faf8f5', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                      <span style={{ background: '#fce8e6', color: '#c5221f', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold' }}>MASTER</span>
                    </div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>Master Admin Passcode</h4>
                    <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '0 0 14px' }}>
                      Used to unlock this Admin portal and override security controls.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffModalRole('admin');
                        setNewStaffPasscode('');
                        setStaffMessage({ text: '', type: '' });
                      }}
                      className="button"
                      style={{ width: '100%', justifyContent: 'center', background: '#b72a2a', borderColor: '#b72a2a', fontSize: '0.84rem', padding: '9px' }}
                    >
                      Change Master Passcode
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: REPORTS & HISTORICAL TOTALS (PAST DAYS & MONTHS)
           ========================================================================= */}
        {activeTab === 'reports' && (
          <div>
            {/* Reports Control & Filter Bar */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '18px', padding: '24px 28px', marginBottom: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>📈 Financial Reports &amp; Past Totals</h3>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                    View daily audit ledgers, monthly totals, UPI vs Cash breakdowns, and export records for accounting.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Period Switcher */}
                  <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', border: '1px solid #e5e7eb' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setReportPeriod('daily');
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: reportPeriod === 'daily' ? '#01621f' : 'transparent',
                        color: reportPeriod === 'daily' ? '#fff' : '#4b5563',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      📅 Daily Totals
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportPeriod('monthly');
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: reportPeriod === 'monthly' ? '#01621f' : 'transparent',
                        color: reportPeriod === 'monthly' ? '#fff' : '#4b5563',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      🗓️ Monthly Totals
                    </button>
                  </div>

                  {/* Month Picker (for Daily view) */}
                  {reportPeriod === 'daily' && (
                    <input
                      type="month"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid #d1d5db',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                        background: '#fff',
                      }}
                      title="Filter daily reports by month"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => fetchReports()}
                    className="button-secondary"
                    style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                  >
                    🔄 Refresh
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="button"
                    style={{
                      background: '#01621f',
                      borderColor: '#01621f',
                      padding: '8px 16px',
                      fontSize: '0.84rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>📥</span>
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {reportLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                <p>Generating report calculations...</p>
              </div>
            ) : reportData ? (
              <div>
                {/* Period Summary KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 22px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Period Revenue</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#01621f', marginTop: '6px' }}>₹{reportData.summary?.totalRevenue || 0}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '4px' }}>
                      ₹{reportData.summary?.upiRevenue || 0} UPI • ₹{reportData.summary?.codRevenue || 0} Cash
                    </div>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 22px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Orders</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)', marginTop: '6px' }}>{reportData.summary?.totalOrders || 0}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '4px' }}>
                      {reportData.summary?.deliveredOrders || 0} Delivered ({reportData.summary?.deliveredRate || 0}%)
                    </div>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 22px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Online UPI Share</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', marginTop: '6px' }}>
                      {reportData.summary?.totalRevenue > 0
                        ? Math.round(((reportData.summary?.upiRevenue || 0) / reportData.summary.totalRevenue) * 100)
                        : 0}%
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '4px' }}>₹{reportData.summary?.upiRevenue || 0} via Razorpay</div>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 22px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Average Order Value</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>₹{reportData.summary?.avgOrderValue || 0}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '4px' }}>Per placed order</div>
                  </div>
                </div>

                {/* Main Breakdown Ledger Table */}
                <div className="admin-table-card" style={{ marginBottom: '28px' }}>
                  <div className="admin-table-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                      {reportPeriod === 'daily' ? `📅 Daily Ledger Records (${reportMonth})` : '🗓️ Monthly Revenue & Performance Summary'}
                    </h4>
                    <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                      {reportData.timeline?.length || 0} record periods found
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{reportPeriod === 'daily' ? 'Date & Day' : 'Month'}</th>
                          <th style={{ textAlign: 'center' }}>Total Orders</th>
                          <th style={{ textAlign: 'center' }}>Delivered</th>
                          <th style={{ textAlign: 'right' }}>Online UPI (₹)</th>
                          <th style={{ textAlign: 'right' }}>Cash / COD (₹)</th>
                          <th style={{ textAlign: 'right' }}>Total Revenue (₹)</th>
                          {reportPeriod === 'daily' && <th>Top Selling Dish</th>}
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.timeline && reportData.timeline.length > 0 ? (
                          reportData.timeline.map((entry) => (
                            <tr key={entry.key}>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                                  {entry.label || entry.key}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                                  {entry.key}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                <span style={{ padding: '3px 9px', background: '#f3f4f6', borderRadius: '12px', fontSize: '0.82rem' }}>
                                  {entry.ordersCount}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ padding: '3px 9px', background: '#e6f5eb', color: '#01621f', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>
                                  {entry.deliveredCount}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>
                                ₹{entry.upiRevenue || 0}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#b06000' }}>
                                ₹{entry.codRevenue || 0}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.98rem', color: '#01621f' }}>
                                ₹{entry.totalRevenue || 0}
                              </td>
                              {reportPeriod === 'daily' && (
                                <td style={{ fontSize: '0.84rem', color: 'var(--text)' }}>
                                  {entry.topDish || '-'}
                                </td>
                              )}
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  {reportPeriod === 'daily' && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedDayLedger(entry)}
                                      className="button-secondary"
                                      style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                                      title="Inspect all individual customer orders on this date"
                                    >
                                      👁️ Ledger
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => (reportPeriod === 'daily' ? handleExportDayCSV(entry) : handleExportCSV())}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '0.78rem',
                                      background: '#f3f4f6',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                    title="Download CSV for this period"
                                  >
                                    📥 CSV
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={reportPeriod === 'daily' ? 8 : 7} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
                              No orders found for the selected {reportPeriod === 'daily' ? `month (${reportMonth})` : 'period'}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Secondary Analytics: Top Dishes & Delivery Fleet Settlement */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  {/* Card 1: Top Dishes */}
                  <div className="admin-table-card">
                    <div className="admin-table-card-header">
                      <h4 style={{ margin: 0, fontSize: '1.05rem' }}>🍲 Top Selling Dishes (This Period)</h4>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      {reportData.topDishes && reportData.topDishes.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {reportData.topDishes.slice(0, 6).map((dish, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fafafa', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                              <div>
                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                                  {idx + 1}. {dish.title}
                                </span>
                                <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                                  {dish.quantity} orders fulfilled
                                </div>
                              </div>
                              <div style={{ fontWeight: 800, color: '#01621f', fontSize: '0.94rem' }}>
                                ₹{dish.revenue || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: 0 }}>No item sales recorded in this period.</p>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Delivery Fleet Settlement */}
                  <div className="admin-table-card">
                    <div className="admin-table-card-header">
                      <h4 style={{ margin: 0, fontSize: '1.05rem' }}>🛵 Delivery Fleet Settlement</h4>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      {reportData.riderSettlement && reportData.riderSettlement.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {reportData.riderSettlement.map((rider, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fafafa', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                              <div>
                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                                  {rider.name}
                                </span>
                                <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                                  {rider.deliveredCount} delivered • {rider.phone || '-'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, color: '#b06000', fontSize: '0.94rem' }}>
                                  ₹{rider.cashCollected || 0} Cash
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#2563eb' }}>
                                  ₹{rider.onlineDelivered || 0} Online
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: 0 }}>No fleet deliveries recorded in this period.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* MODAL 1: ADD NEW STAFF MEMBER */}
      {showAddStaffModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>➕ Add New Staff Member</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: '0 0 20px' }}>
              Create an individual account in MongoDB for a Kitchen Manager, Owner, or Delivery Rider.
            </p>

            <form onSubmit={handleCreateStaffUser}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Staff Role *</label>
                <select
                  value={addStaffForm.role}
                  onChange={(e) => setAddStaffForm((prev) => ({ ...prev, role: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db', fontSize: '0.9rem' }}
                >
                  <option value="manager">Kitchen Manager (/manager portal)</option>
                  <option value="owner">Restaurant Owner (Full access)</option>
                  <option value="delivery">Delivery Partner (/delivery portal)</option>
                </select>
              </div>

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Joshi"
                  value={addStaffForm.name}
                  onChange={(e) => setAddStaffForm((prev) => ({ ...prev, name: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>10-Digit Mobile Number (Login ID) *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={addStaffForm.phone}
                  onChange={(e) => setAddStaffForm((prev) => ({ ...prev, phone: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db', letterSpacing: '1px' }}
                />
              </div>

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Initial Password / Rider PIN * (min 4 chars)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. chef2026 or 1234"
                  value={addStaffForm.password}
                  onChange={(e) => setAddStaffForm((prev) => ({ ...prev, password: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                />
              </div>

              {addStaffForm.role === 'delivery' && (
                <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Vehicle / Bike Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. MH 12 AB 1234"
                    value={addStaffForm.vehicleNumber}
                    onChange={(e) => setAddStaffForm((prev) => ({ ...prev, vehicleNumber: e.target.value }))}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                  />
                </div>
              )}

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '18px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. staff@paranjapefoods.com"
                  value={addStaffForm.email}
                  onChange={(e) => setAddStaffForm((prev) => ({ ...prev, email: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                />
              </div>

              {addStaffError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '16px', background: '#fce8e6', color: '#c5221f' }}>
                  {addStaffError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="button-secondary"
                  disabled={addStaffSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={addStaffSubmitting || !addStaffForm.name || !addStaffForm.phone || !addStaffForm.password}
                >
                  {addStaffSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT STAFF MEMBER */}
      {editingStaffUser && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>✏️ Edit Staff Details</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: '0 0 20px' }}>
              Updating profile for <strong>{editingStaffUser.name}</strong> ({editingStaffUser.phone}).
            </p>

            <form onSubmit={handleEditStaffUser}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={editStaffForm.name}
                  onChange={(e) => setEditStaffForm((prev) => ({ ...prev, name: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                />
              </div>

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Role *</label>
                <select
                  value={editStaffForm.role}
                  onChange={(e) => setEditStaffForm((prev) => ({ ...prev, role: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                >
                  <option value="manager">Kitchen Manager</option>
                  <option value="owner">Restaurant Owner</option>
                  <option value="delivery">Delivery Partner</option>
                </select>
              </div>

              {editStaffForm.role === 'delivery' && (
                <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Vehicle / Bike Number</label>
                  <input
                    type="text"
                    placeholder="e.g. MH 12 AB 1234"
                    value={editStaffForm.vehicleNumber}
                    onChange={(e) => setEditStaffForm((prev) => ({ ...prev, vehicleNumber: e.target.value }))}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                  />
                </div>
              )}

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '18px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Email Address</label>
                <input
                  type="email"
                  value={editStaffForm.email}
                  onChange={(e) => setEditStaffForm((prev) => ({ ...prev, email: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                />
              </div>

              {editStaffError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '16px', background: '#fce8e6', color: '#c5221f' }}>
                  {editStaffError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => setEditingStaffUser(null)}
                  className="button-secondary"
                  disabled={editStaffSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={editStaffSubmitting || !editStaffForm.name}
                >
                  {editStaffSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET INDIVIDUAL STAFF PASSWORD / PIN */}
      {resetStaffUser && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>
              🔑 Reset {resetStaffUser.role === 'delivery' ? 'Rider PIN' : 'Password'}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: '0 0 20px' }}>
              Setting a new security {resetStaffUser.role === 'delivery' ? 'PIN' : 'password'} for <strong>{resetStaffUser.name}</strong> ({resetStaffUser.phone}).
            </p>

            <form onSubmit={handleResetStaffPassword}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  New {resetStaffUser.role === 'delivery' ? 'Rider PIN' : 'Password'} (min 4 chars) *
                </label>
                <input
                  type="text"
                  required
                  placeholder={resetStaffUser.role === 'delivery' ? 'e.g. 5566 or rider2026' : 'e.g. kitchen2026'}
                  value={newStaffUserPassword}
                  onChange={(e) => setNewStaffUserPassword(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                  autoFocus
                />
              </div>

              {resetStaffMessage.text && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '16px', background: resetStaffMessage.type === 'success' ? '#e6f5eb' : '#fce8e6', color: resetStaffMessage.type === 'success' ? '#01621f' : '#c5221f' }}>
                  {resetStaffMessage.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => setResetStaffUser(null)}
                  className="button-secondary"
                  disabled={resetStaffSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={resetStaffSubmitting || !newStaffUserPassword}
                >
                  {resetStaffSubmitting ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RESET CUSTOMER PASSWORD */}
      {resetModalCustomer && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>Reset Customer Password</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: '0 0 20px' }}>
              Setting a new login password for <strong>{resetModalCustomer.name}</strong> ({resetModalCustomer.phone}).
            </p>

            <form onSubmit={handleCustomerPasswordReset}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>New Password (min 4 chars) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. pune2026 or food123"
                  value={newCustomerPassword}
                  onChange={(e) => setNewCustomerPassword(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                  autoFocus
                />
              </div>

              {resetMessage.text && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '16px', background: resetMessage.type === 'success' ? '#e6f5eb' : '#fce8e6', color: resetMessage.type === 'success' ? '#01621f' : '#c5221f' }}>
                  {resetMessage.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => setResetModalCustomer(null)}
                  className="button-secondary"
                  disabled={resetSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={resetSubmitting || !newCustomerPassword}
                >
                  {resetSubmitting ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: RESET SYSTEM PASSCODE */}
      {staffModalRole && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>
              Set New Passcode for {staffModalRole === 'manager' ? 'Kitchen Manager' : staffModalRole === 'delivery' ? 'Delivery Fleet' : 'Master Admin'}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: '0 0 20px' }}>
              This passcode will be hashed and updated across all active devices immediately.
            </p>

            <form onSubmit={handleStaffPasscodeReset}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>New Passcode (min 4 characters) *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter new security passcode"
                  value={newStaffPasscode}
                  onChange={(e) => setNewStaffPasscode(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #d1d5db' }}
                  autoFocus
                />
              </div>

              {staffMessage.text && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '16px', background: staffMessage.type === 'success' ? '#e6f5eb' : '#fce8e6', color: staffMessage.type === 'success' ? '#01621f' : '#c5221f' }}>
                  {staffMessage.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '22px' }}>
                <button
                  type="button"
                  onClick={() => setStaffModalRole(null)}
                  className="button-secondary"
                  disabled={staffSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={staffSubmitting || !newStaffPasscode}
                >
                  {staffSubmitting ? 'Updating...' : 'Save Passcode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: DAY LEDGER DRILL-DOWN */}
      {selectedDayLedger && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedDayLedger(null)}>
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>
                  📜 Daily Ledger: {selectedDayLedger.label}
                </h3>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.84rem' }}>
                  Detailed audit of all {selectedDayLedger.ordersCount} customer orders placed on this date.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleExportDayCSV(selectedDayLedger)}
                  className="button"
                  style={{ background: '#01621f', borderColor: '#01621f', padding: '7px 14px', fontSize: '0.8rem' }}
                >
                  📥 Export Day CSV
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDayLedger(null)}
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

            {/* Quick Metrics Bar for Day */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px', padding: '12px 16px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                <strong>Total Orders:</strong> {selectedDayLedger.ordersCount}
              </span>
              <span style={{ color: '#d1d5db' }}>|</span>
              <span style={{ fontSize: '0.82rem', color: '#01621f' }}>
                <strong>Delivered:</strong> {selectedDayLedger.deliveredCount}
              </span>
              <span style={{ color: '#d1d5db' }}>|</span>
              <span style={{ fontSize: '0.82rem', color: '#2563eb' }}>
                <strong>Online UPI:</strong> ₹{selectedDayLedger.upiRevenue || 0}
              </span>
              <span style={{ color: '#d1d5db' }}>|</span>
              <span style={{ fontSize: '0.82rem', color: '#b06000' }}>
                <strong>Cash on Delivery:</strong> ₹{selectedDayLedger.codRevenue || 0}
              </span>
              <span style={{ color: '#d1d5db' }}>|</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                <strong>Gross Total:</strong> ₹{selectedDayLedger.totalRevenue || 0}
              </span>
            </div>

            {/* Order Ledger Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th>Order &amp; Time</th>
                    <th>Customer</th>
                    <th>Destination</th>
                    <th>Dishes</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayLedger.orders && selectedDayLedger.orders.length > 0 ? (
                    selectedDayLedger.orders.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--accent)' }}>#{o.shortId}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                            {new Date(o.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{o.customerName}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{o.customerPhone}</div>
                        </td>
                        <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.addressSummary}>
                          {o.addressSummary}
                        </td>
                        <td style={{ maxWidth: '180px', fontSize: '0.78rem' }}>
                          {o.dishesText}
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
                            {o.paymentMethod === 'razorpay' ? 'UPI' : 'Cash'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.72rem',
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                        No orders recorded for this day.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setSelectedDayLedger(null)}
                className="button-secondary"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
