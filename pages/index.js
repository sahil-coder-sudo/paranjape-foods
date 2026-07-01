import Head from 'next/head';
import NavBar from '../components/NavBar';

export default function Home() {
  return (
    <>
      <Head>
        <title>Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Paranjape Foods - fresh seasonal breakfasts, sandwiches, and desserts." />
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
            <div className="eyebrow">Fresh, seasonal & made to share</div>
            <h1>Modern comfort food for every table.</h1>
            <p>Enjoy a curated menu of breakfast classics, handcrafted sandwiches, and sweet desserts in a warm neighborhood setting.</p>
            <div className="hero-actions">
              <a href="#menu" className="button">View menu</a>
              <a href="#contact" className="button-secondary">Reserve a table</a>
            </div>
          </div>
          <div className="hero-image">
            <img
              src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80"
              alt="Plated restaurant dish"
            />
          </div>
        </section>

        <section className="section" id="menu">
          <h2>Menu highlights</h2>
          <div className="menu-grid">
            <article className="menu-card">
              <h3>Morning Favorites</h3>
              <p>Start the day with bright flavors and baked goods made fresh each morning.</p>
              <div className="menu-item"><span>Avocado Toast</span><span>₹14</span></div>
              <div className="menu-item"><span>Granola Bowl</span><span>₹12</span></div>
              <div className="menu-item"><span>Lemon Ricotta Pancakes</span><span>₹16</span></div>
            </article>

            <article className="menu-card">
              <h3>Chef's Sandwiches</h3>
              <p>Handheld favorites with house sauces, local greens, and fresh bakery bread.</p>
              <div className="menu-item"><span>Smoked Turkey Club</span><span>₹18</span></div>
              <div className="menu-item"><span>Spicy Falafel Wrap</span><span>₹15</span></div>
              <div className="menu-item"><span>Grilled Chicken Panini</span><span>₹17</span></div>
            </article>

            <article className="menu-card">
              <h3>Garden Plates</h3>
              <p>Seasonal salads and vegetable-forward dishes for light, satisfying meals.</p>
              <div className="menu-item"><span>Kale Caesar</span><span>₹13</span></div>
              <div className="menu-item"><span>Roasted Beet Salad</span><span>₹14</span></div>
              <div className="menu-item"><span>Quinoa Harvest Bowl</span><span>₹16</span></div>
            </article>

            <article className="menu-card">
              <h3>Sweet Endings</h3>
              <p>Finish your meal with house-made pastries and dessert specials.</p>
              <div className="menu-item"><span>Chocolate Tart</span><span>₹9</span></div>
              <div className="menu-item"><span>Berry Crumble</span><span>₹10</span></div>
              <div className="menu-item"><span>Espresso Affogato</span><span>₹8</span></div>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="info-grid">
            <article className="info-card">
              <div className="badge">Open daily</div>
              <h3>Breakfast & Lunch</h3>
              <p>Mon–Fri 7:30am–3:00pm<br />Sat–Sun 8:00am–4:00pm</p>
            </article>
            <article className="info-card">
              <div className="badge">Book now</div>
              <h3>Reserve a table</h3>
              <p>Call us or send a message for weekend seating and brunch group plans.</p>
            </article>
          </div>
        </section>

        <section className="section" id="contact">
          <h2>Contact</h2>
          <div className="intro">
            <p>Located in the heart of the neighborhood with easy walk-in access and curbside pick-up.</p>
          </div>
          <div className="menu-card">
            <h3>Sunrise Bistro</h3>
            <p>123 Garden Street, Suite 5<br />Open daily for breakfast and lunch.</p>
            <p>Phone: (555) 123-4567<br />Email: hello@sunrisebistro.example</p>
          </div>
        </section>

        <footer className="footer">
          <p>Simple restaurant website sample built for mobile-first browsing.</p>
        </footer>
      </main>
    </>
  );
}
