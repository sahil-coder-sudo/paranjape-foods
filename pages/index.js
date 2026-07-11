import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

export default function Home() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Paranjape Foods - Order fresh, seasonal meals delivered to your door." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <main className="page">
        <NavBar />

        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow">Fresh & Convenient</div>
            <h1>Order your favorite meals online.</h1>
            <p>Delivery to your doorstep. Fresh. Fast. Delicious.</p>
            <div className="hero-actions">
              <button onClick={() => router.push('/checkout')} className="button">
                Order Now
              </button>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>How it works</h2>
          <div className="steps-grid">
            <article className="step-card">
              <div className="step-number">1</div>
              <h3>Select Items</h3>
              <p>Browse our menu and add items to your cart.</p>
            </article>
            <article className="step-card">
              <div className="step-number">2</div>
              <h3>Confirm Address</h3>
              <p>Enter or select your delivery address.</p>
            </article>
            <article className="step-card">
              <div className="step-number">3</div>
              <h3>Pay Securely</h3>
              <p>Complete payment with Razorpay. Safe & secure.</p>
            </article>
            <article className="step-card">
              <div className="step-number">4</div>
              <h3>Track Order</h3>
              <p>Real-time updates on your order status.</p>
            </article>
          </div>
        </section>

        <footer className="footer">
          <p>Paranjape Foods - Delivery Excellence</p>
        </footer>
      </main>
    </>
  );
}
