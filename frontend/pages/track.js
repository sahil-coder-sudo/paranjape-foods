import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

const TRACKING_MILESTONES = [
  {
    key: 'placed',
    title: 'Order Confirmed',
    desc: 'We have received your order and sent it to our kitchen.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    key: 'preparing',
    title: 'Preparing & Cooking in Kitchen',
    desc: 'Chef is cooking and packaging your dishes with authentic spices.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 13.8V4a2 2 0 1 1 4 0v9.8" />
        <path d="M14 13.8V4a2 2 0 1 1 4 0v9.8" />
        <rect x="3" y="14" width="18" height="6" rx="2" />
      </svg>
    ),
  },
  {
    key: 'ready',
    title: 'Packed & Ready for Pickup',
    desc: 'Meal is hot-sealed, quality checked and awaiting dispatch.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    key: 'out_for_delivery',
    title: 'Out for Delivery',
    desc: 'Delivery executive has picked up your food and is on the way.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M15 6h-5a2 2 0 0 0-2 2v6" />
        <path d="M9 17h6" />
        <path d="M19 17v-4l-3-3h-3" />
      </svg>
    ),
  },
  {
    key: 'delivered',
    title: 'Delivered',
    desc: 'Order handed over. Enjoy your meal! Bon appétit.',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

const STATUS_RANK = {
  placed: 0,
  confirmed: 0,
  preparing: 1,
  ready: 2,
  out_for_delivery: 3,
  delivered: 4,
  cancelled: -1,
};

export default function TrackOrder() {
  const router = useRouter();
  const { orderId } = router.query;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOrderId, setSearchOrderId] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [connectedLive, setConnectedLive] = useState(false);

  const eventSourceRef = useRef(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  // Determine current active order id
  const activeId = orderId || (typeof window !== 'undefined' ? localStorage.getItem('lastOrderId') : null);

  const fetchOrder = async (id) => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/order/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        setError('');
      } else {
        setError('Order not found. Please check your order reference ID.');
      }
    } catch (err) {
      setError('Unable to load order details. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeId) {
      fetchOrder(activeId);
    } else {
      setLoading(false);
    }
  }, [activeId]);

  // Real-Time SSE Stream for live periodic updates
  useEffect(() => {
    if (!activeId) return;

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      try {
        const es = new EventSource(`${API_BASE}/api/order/${activeId}/stream`);
        eventSourceRef.current = es;

        es.addEventListener('connected', () => {
          setConnectedLive(true);
        });

        es.addEventListener('order_update', (e) => {
          try {
            const updated = JSON.parse(e.data);
            setOrder(updated);

            // Trigger notification banner
            const milestone = TRACKING_MILESTONES.find((m) => m.key === updated.orderStatus);
            const statusLabel = milestone ? milestone.title : updated.orderStatus;
            setToastMessage(`Update: Your order is now "${statusLabel}"!`);
            setTimeout(() => setToastMessage(''), 5000);
          } catch (parseErr) {
            console.error('Error parsing SSE update', parseErr);
          }
        });

        es.onerror = () => {
          setConnectedLive(false);
        };
      } catch (err) {
        console.warn('SSE connection failed, falling back to periodic poll');
      }
    }

    // Polling fallback every 7 seconds
    const interval = setInterval(() => {
      fetchOrder(activeId);
    }, 7000);

    return () => {
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [activeId]);

  const handleManualSearch = (e) => {
    e.preventDefault();
    const clean = searchOrderId.trim().replace(/^#?PF-?/i, '');
    if (clean) {
      router.push(`/track?orderId=${clean}`);
      fetchOrder(clean);
    }
  };

  const currentRank = order ? (STATUS_RANK[order.orderStatus] !== undefined ? STATUS_RANK[order.orderStatus] : 0) : 0;
  const isCancelled = order?.orderStatus === 'cancelled';

  // Format order date & timestamps
  const getTimestampForStatus = (statusKey) => {
    if (!order) return null;
    if (Array.isArray(order.statusHistory)) {
      const match = order.statusHistory.slice().reverse().find((h) => h.status === statusKey);
      if (match && match.timestamp) {
        return new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    if (statusKey === 'placed' && order.createdAt) {
      return new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return null;
  };

  return (
    <>
      <Head>
        <title>Track Order - Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page" style={{ maxWidth: '620px' }}>
        <NavBar />

        {/* Real-time Toast Alert */}
        {toastMessage && (
          <div className="manager-toast-banner" role="alert">
            <span style={{ fontSize: '1.2rem' }}>🔔</span>
            <span>{toastMessage}</span>
          </div>
        )}

        <div style={{ marginBottom: '18px' }}>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '2rem', margin: '0 0 6px' }}>
            Track Your Order
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem' }}>
            Live Amazon-style periodic updates from kitchen preparation to doorstep delivery.
          </p>
        </div>

        {/* Search Bar for Order Reference */}
        <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '8px', marginBottom: '22px' }}>
          <input
            type="text"
            placeholder="Enter Order ID (e.g. 6ae0... or #PF-61630B)"
            value={searchOrderId}
            onChange={(e) => setSearchOrderId(e.target.value)}
            style={{
              flexGrow: 1,
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1.5px solid var(--border)',
              background: 'var(--card)',
              fontSize: '0.9rem',
              color: 'var(--text)',
            }}
          />
          <button type="submit" className="button" style={{ padding: '10px 18px', whiteSpace: 'nowrap' }}>
            Track
          </button>
        </form>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            <p>Loading your live order tracking updates...</p>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {order && (
          <div>
            {/* Amazon-Style Order Status Card */}
            <div className="amazon-tracker-card">
              {/* ETA Banner */}
              <div className="tracker-eta-banner">
                <div className="tracker-eta-info">
                  <h3>
                    {isCancelled
                      ? 'Order Cancelled'
                      : order.orderStatus === 'delivered'
                      ? 'Delivered to Doorstep'
                      : order.orderStatus === 'out_for_delivery'
                      ? 'Arriving in ~10 - 15 Mins'
                      : 'Arriving in ~30 - 40 Mins'}
                  </h3>
                  <p>
                    Order Ref: #PF-{String(order._id).slice(-6).toUpperCase()} • Placed on{' '}
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="tracker-live-pill">
                  <span className="live-pulse-dot" />
                  <span>Live Updates</span>
                </div>
              </div>

              {isCancelled ? (
                <div style={{ padding: '20px', background: '#fce8e6', borderRadius: '12px', color: '#c94f2f' }}>
                  <strong>This order was cancelled.</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                    If you have questions or require a refund, please contact customer support.
                  </p>
                </div>
              ) : (
                /* The Amazon-style vertical timeline */
                <div className="amazon-timeline">
                  {TRACKING_MILESTONES.map((milestone, idx) => {
                    const isCompleted = currentRank > idx;
                    const isActive = currentRank === idx;
                    const isUpcoming = currentRank < idx;
                    const timeStamp = getTimestampForStatus(milestone.key);

                    return (
                      <div
                        key={milestone.key}
                        className={`timeline-step ${
                          isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'
                        }`}
                      >
                        <div className="timeline-left-col">
                          <div className="timeline-node">
                            {isCompleted ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : isActive ? (
                              milestone.icon
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{idx + 1}</span>
                            )}
                          </div>
                          {idx < TRACKING_MILESTONES.length - 1 && (
                            <div className="timeline-connector" />
                          )}
                        </div>

                        <div className="timeline-content">
                          <div className="timeline-header-row">
                            <span className="timeline-title">
                              {milestone.title}
                              {isActive && (
                                <span
                                  style={{
                                    marginLeft: '8px',
                                    fontSize: '0.72rem',
                                    background: '#ffded4',
                                    color: 'var(--accent)',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                  }}
                                >
                                  In Progress
                                </span>
                              )}
                            </span>
                            {timeStamp && <span className="timeline-time">{timeStamp}</span>}
                          </div>
                          <p className="timeline-subtitle">{milestone.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delivery Address & Items Breakdown */}
            <div className="order-details-card">
              <div className="order-details-header">
                <div>
                  <div className="order-id-label">Delivery Destination</div>
                  <div style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--text)', marginTop: '2px' }}>
                    {order.addressId
                      ? `${order.addressId.flatNo ? order.addressId.flatNo + ', ' : ''}${order.addressId.buildingName ? order.addressId.buildingName + ', ' : ''}${order.addressId.street || ''}, ${order.addressId.city || 'Pune'}`
                      : 'Pune, Maharashtra'}
                  </div>
                </div>
                <span
                  style={{
                    background: '#e6f4ea',
                    color: '#137333',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '5px 12px',
                    borderRadius: '20px',
                  }}
                >
                  {order.paymentMethod === 'cod' ? 'Pay on Delivery' : 'Paid Online'}
                </span>
              </div>

              {/* Items List */}
              <div className="order-items-recap" style={{ borderTop: 'none', paddingTop: 0 }}>
                <h4>Dishes in this Order</h4>
                {order.items &&
                  order.items.map((it, idx) => (
                    <div key={idx} className="order-item-recap-row">
                      <span>{it.title || 'Specialty Dish'} × {it.quantity}</span>
                      <span>₹{it.price * it.quantity}</span>
                    </div>
                  ))}
                <div className="order-total-recap-row">
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--accent)' }}>₹{order.totalAmount}</span>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href="tel:+919876543210"
                  className="button-secondary"
                  style={{ flex: '1 1 180px', justifyContent: 'center', padding: '10px', textDecoration: 'none' }}
                >
                  📞 Contact Kitchen
                </a>
                <button
                  type="button"
                  onClick={() => router.push('/menu')}
                  className="button"
                  style={{ flex: '1 1 180px', justifyContent: 'center', padding: '10px' }}
                >
                  Order More Food
                </button>
              </div>
            </div>
          </div>
        )}

        {!order && !loading && !activeId && (
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '30px 20px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--muted)', margin: '0 0 16px' }}>
              No active order found in this browser. Please enter your Order ID above or place a new order.
            </p>
            <button onClick={() => router.push('/menu')} className="button">
              Explore Our Menu →
            </button>
          </div>
        )}
      </main>
    </>
  );
}
