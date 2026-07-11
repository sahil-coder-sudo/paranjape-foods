import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

export default function Checkout() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [newAddress, setNewAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setCustomer(JSON.parse(savedCustomer));
      fetchAddresses(JSON.parse(savedCustomer)._id);
    }
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/menu`);
      const data = await res.json();
      setMenuItems(data);
    } catch (err) {
      setError('Failed to load menu');
    }
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

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    const phone = e.target.phone.value;
    const name = e.target.name.value;
    const email = e.target.email.value;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, email }),
      });
      const data = await res.json();
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

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setLoading(true);
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
      if (res.ok) {
        setAddresses([...addresses, data]);
        setSelectedAddress(data._id);
        setNewAddress({ street: '', city: '', state: '', zipCode: '' });
      } else {
        setError(data.error || 'Failed to validate address');
      }
    } catch (err) {
      setError('Failed to add address');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setError('Please select an address');
      return;
    }

    setLoading(true);
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
      if (res.ok) {
        // Initiate Razorpay payment
        initiateRazorpayPayment(data);
      } else {
        setError(data.error || 'Failed to create order');
      }
    } catch (err) {
      setError('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const initiateRazorpayPayment = (orderData) => {
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Math.round(orderData.amount * 100),
      currency: 'INR',
      order_id: orderData.razorpayOrderId,
      handler: async (response) => {
        // Verify payment on backend
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
            localStorage.removeItem('cart');
            setStep(5); // Go to tracking page
          } else {
            setError('Payment verification failed');
          }
        } catch (err) {
          setError('Failed to verify payment');
        }
      },
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.phone,
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
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
              <h2>Step 1: Your Details</h2>
              <form onSubmit={handleCustomerSubmit}>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="tel" name="phone" required placeholder="10 digit mobile number" />
                </div>
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" name="name" required placeholder="Your name" />
                </div>
                <div className="form-group">
                  <label>Email (Optional)</label>
                  <input type="email" name="email" placeholder="your@email.com" />
                </div>
                <button type="submit" disabled={loading} className="button">
                  {loading ? 'Loading...' : 'Continue'}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Menu Selection */}
          {step === 2 && customer && (
            <div className="checkout-step">
              <h2>Step 2: Select Items</h2>
              <div className="menu-items-grid">
                {menuItems.map((item) => (
                  <div key={item._id} className="menu-item-card">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <p className="price">₹{item.price}</p>
                    <div className="item-controls">
                      <button
                        onClick={() => {
                          const existing = cart.find((c) => c.menuItemId === item._id);
                          if (existing) {
                            existing.quantity--;
                            if (existing.quantity === 0) {
                              setCart(cart.filter((c) => c.menuItemId !== item._id));
                            } else {
                              setCart([...cart]);
                            }
                          }
                          localStorage.setItem('cart', JSON.stringify(cart));
                        }}
                      >
                        −
                      </button>
                      <span>
                        {cart.find((c) => c.menuItemId === item._id)?.quantity || 0}
                      </span>
                      <button
                        onClick={() => {
                          const existing = cart.find((c) => c.menuItemId === item._id);
                          if (existing) {
                            existing.quantity++;
                          } else {
                            cart.push({
                              menuItemId: item._id,
                              quantity: 1,
                              price: item.price,
                            });
                          }
                          setCart([...cart]);
                          localStorage.setItem('cart', JSON.stringify(cart));
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="checkout-footer">
                <p>Total: ₹{calculateTotal()}</p>
                <button
                  onClick={() => setStep(3)}
                  disabled={cart.length === 0}
                  className="button"
                >
                  Proceed to Address
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Address Selection */}
          {step === 3 && customer && (
            <div className="checkout-step">
              <h2>Step 3: Delivery Address</h2>
              {addresses.length > 0 && (
                <div className="addresses-list">
                  <h3>Saved Addresses</h3>
                  {addresses.map((addr) => (
                    <div
                      key={addr._id}
                      className={`address-card ${selectedAddress === addr._id ? 'selected' : ''}`}
                      onClick={() => setSelectedAddress(addr._id)}
                    >
                      <p>
                        {addr.street}, {addr.city}, {addr.state} {addr.zipCode}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="new-address-form">
                <h3>Add New Address</h3>
                <form onSubmit={handleAddAddress}>
                  <div className="form-group">
                    <label>Street Address</label>
                    <input
                      type="text"
                      value={newAddress.street}
                      onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                      placeholder="Street address"
                      required
                    />
                  </div>
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
                  <div className="form-group">
                    <label>Zip Code</label>
                    <input
                      type="text"
                      value={newAddress.zipCode}
                      onChange={(e) => setNewAddress({ ...newAddress, zipCode: e.target.value })}
                      placeholder="Zip code"
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className="button-secondary">
                    {loading ? 'Validating...' : 'Add Address'}
                  </button>
                </form>
              </div>

              <div className="checkout-footer">
                <button
                  onClick={() => setStep(4)}
                  disabled={!selectedAddress}
                  className="button"
                >
                  Proceed to Payment
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && customer && (
            <div className="checkout-step">
              <h2>Step 4: Review & Pay</h2>
              <div className="order-summary">
                <h3>Order Summary</h3>
                {cart.map((item) => {
                  const menuItem = menuItems.find((m) => m._id === item.menuItemId);
                  return (
                    <div key={item.menuItemId} className="summary-item">
                      <span>{menuItem?.title}</span>
                      <span>
                        ₹{item.price} x {item.quantity} = ₹{item.price * item.quantity}
                      </span>
                    </div>
                  );
                })}
                <hr />
                <div className="summary-total">
                  <strong>Total: ₹{calculateTotal()}</strong>
                </div>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={loading}
                className="button"
              >
                {loading ? 'Processing...' : 'Pay Now with Razorpay'}
              </button>
            </div>
          )}

          {/* Step 5: Order Tracking */}
          {step === 5 && (
            <div className="checkout-step">
              <h2>Step 5: Order Placed!</h2>
              <p>Your order has been placed successfully. Tracking details coming soon!</p>
              <button onClick={() => router.push('/')} className="button">
                Back to Home
              </button>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </section>
      </main>
    </>
  );
}
