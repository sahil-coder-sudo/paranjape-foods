import Head from 'next/head';
import { useRouter } from 'next/router';
import NavBar from '../components/NavBar';

export default function Home() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Paranjape Foods - Authentic Maharashtrian Delicacies</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Paranjape Foods - Order fresh, authentic Maharashtrian meals delivered to your doorstep." />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <main className="page">
        <NavBar />

        {/* Top Society Announcement Bar */}
        <div
          style={{
            background: '#e6f5eb',
            border: '1px solid #a3d9b4',
            borderRadius: '14px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '0.84rem',
            fontWeight: 700,
            color: '#01621f',
            marginBottom: '18px',
            textAlign: 'center',
          }}
        >
          <span>🌱</span>
          <span>100% Shuddh Shakahari • Fresh Doorstep Delivery</span>
        </div>

        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content" style={{ textAlign: 'center' }}>
            {/* Logo Emblem */}
            <div style={{ marginBottom: '8px' }}>
              <img
                src="/logo.svg"
                alt="Paranjape Foods Logo"
                style={{
                  height: '92px',
                  width: 'auto',
                  margin: '0 auto',
                  filter: 'drop-shadow(0 6px 16px rgba(1, 98, 31, 0.18))',
                }}
              />
            </div>

            {/* Aesthetic Designer Brand Name */}
            <div
              style={{
                fontFamily: 'var(--font-brand)',
                fontSize: '2.6rem',
                fontWeight: 500,
                lineHeight: 1.15,
                margin: '4px 0 12px',
              }}
            >
              <span style={{ color: 'var(--brand-green)' }}>Paranjape</span>{' '}
              <span style={{ color: 'var(--accent)' }}>Foods</span>
            </div>

            <div
              className="eyebrow"
              style={{
                color: 'var(--brand-green)',
                fontWeight: 800,
                letterSpacing: '0.14em',
                marginBottom: '8px',
              }}
            >
              Authentic Maharashtrian Specialties
            </div>

            <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', margin: '0 0 12px', lineHeight: 1.15 }}>
              Comfort Food from Our Kitchen, <span style={{ color: 'var(--brand-green)' }}>Delivered Fresh</span>.
            </h1>

            <p style={{ margin: '0 auto 22px', maxWidth: '440px', color: 'var(--muted)', fontSize: '0.96rem' }}>
              Handcrafted traditional vegetarian delicacies cooked fresh daily with pure authentic spices and delivered hot straight to your doorstep.
            </p>

            <div className="hero-actions" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => router.push('/menu')}
                className="button"
                style={{
                  background: 'var(--accent)',
                  borderColor: 'var(--accent)',
                  padding: '12px 26px',
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(236, 34, 39, 0.28)',
                }}
              >
                Explore Menu →
              </button>
              <button
                type="button"
                onClick={() => router.push('/checkout')}
                className="button-secondary"
                style={{
                  background: '#ffffff',
                  border: '2px solid var(--brand-green)',
                  color: 'var(--brand-green)',
                  padding: '12px 24px',
                  fontSize: '0.96rem',
                  fontWeight: 700,
                }}
              >
                Quick Checkout
              </button>
            </div>
          </div>
        </section>

        {/* 3 Green Heritage Pillars */}
        <section style={{ marginTop: '28px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #e5e7eb',
                borderRadius: '16px',
                padding: '16px 14px',
                textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#e6f5eb',
                  border: '1.5px solid #a3d9b4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  margin: '0 auto 10px',
                }}
              >
                🌿
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--brand-green)', marginBottom: '4px' }}>
                100% Pure Veg
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                Cold-pressed oils, zero preservatives &amp; traditional spices.
              </p>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #e5e7eb',
                borderRadius: '16px',
                padding: '16px 14px',
                textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#e6f5eb',
                  border: '1.5px solid #a3d9b4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  margin: '0 auto 10px',
                }}
              >
                🛵
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--brand-green)', marginBottom: '4px' }}>
                Fast Doorstep Delivery
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                Hot, fresh meals delivered straight to your door with live tracking.
              </p>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #e5e7eb',
                borderRadius: '16px',
                padding: '16px 14px',
                textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#e6f5eb',
                  border: '1.5px solid #a3d9b4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  margin: '0 auto 10px',
                }}
              >
                🍲
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--brand-green)', marginBottom: '4px' }}>
                Grandma&apos;s Taste
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                Authentic comfort dishes perfected over generations.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.3rem' }}>📋</span>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)' }}>How Order &amp; Delivery Works</h2>
          </div>

          <div className="steps-grid">
            <article className="step-card">
              <div className="step-number">1</div>
              <h3>Browse &amp; Select Dishes</h3>
              <p>Explore authentic Maharashtrian breakfast, thalis, and daily specials.</p>
            </article>
            <article className="step-card">
              <div className="step-number">2</div>
              <h3>Confirm Society Address</h3>
              <p>Enter your building name and flat number for precise delivery.</p>
            </article>
            <article className="step-card">
              <div className="step-number">3</div>
              <h3>Pay Securely</h3>
              <p>Pay online via Razorpay (UPI, GPay, Cards) or Cash/UPI on delivery.</p>
            </article>
            <article className="step-card">
              <div className="step-number">4</div>
              <h3>Live Doorstep Tracking</h3>
              <p>Watch your order from kitchen packing to delivery partner handover.</p>
            </article>
          </div>
        </section>

        {/* Signature Dishes Spotlight */}
        <section className="section">
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid #a3d9b4',
              borderRadius: '20px',
              padding: '24px 20px',
              textAlign: 'center',
              boxShadow: '0 6px 20px rgba(1, 98, 31, 0.06)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                background: '#e6f5eb',
                color: '#01621f',
                fontWeight: 800,
                fontSize: '0.76rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '4px 12px',
                borderRadius: '20px',
                marginBottom: '10px',
              }}
            >
              Chef&apos;s Daily Specials
            </span>
            <h3 style={{ margin: '0 0 18px', fontSize: '1.4rem' }}>Hungry for Authentic Flavors?</h3>
            <button
              type="button"
              onClick={() => router.push('/menu')}
              className="button"
              style={{
                background: 'var(--brand-green)',
                borderColor: 'var(--brand-green)',
                padding: '12px 28px',
                fontSize: '0.96rem',
                fontWeight: 700,
                boxShadow: '0 4px 16px rgba(1, 98, 31, 0.28)',
              }}
            >
              View Full Menu &amp; Order Now →
            </button>
          </div>
        </section>

        {/* Premium Brand Green Footer */}
        <footer
          style={{
            marginTop: '36px',
            background: 'linear-gradient(135deg, #01621f 0%, #014616 100%)',
            borderRadius: '22px',
            padding: '32px 22px 24px',
            color: '#ffffff',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(1, 98, 31, 0.22)',
          }}
        >
          <img
            src="/logo.svg"
            alt="Paranjape Foods"
            style={{
              height: '56px',
              width: 'auto',
              margin: '0 auto 10px',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
            }}
          />
          <div
            style={{
              fontFamily: 'var(--font-brand)',
              fontSize: '2.1rem',
              fontWeight: 500,
              lineHeight: 1.1,
              marginBottom: '6px',
            }}
          >
            Paranjape Foods
          </div>
          <p
            style={{
              opacity: 0.9,
              fontSize: '0.88rem',
              maxWidth: '380px',
              margin: '0 auto 18px',
              lineHeight: 1.45,
            }}
          >
            Pure Vegetarian Authentic Flavors from Our Kitchen Straight to Your Doorstep.
          </p>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => router.push('/menu')}
              style={{
                background: '#ffffff',
                color: '#01621f',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '20px',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              Order Food →
            </button>
            <button
              type="button"
              onClick={() => router.push('/track')}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                padding: '10px 18px',
                borderRadius: '20px',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              Track Order
            </button>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              paddingTop: '14px',
              fontSize: '0.76rem',
              opacity: 0.8,
            }}
          >
            © {new Date().getFullYear()} Paranjape Foods • Handcrafted with love
          </div>
        </footer>
      </main>
    </>
  );
}
