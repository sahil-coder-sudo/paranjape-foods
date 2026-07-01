import Head from 'next/head';
import NavBar from '../components/NavBar';

export default function Menu() {
  return (
    <>
      <Head>
        <title>Menu | Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Explore the Paranjape Foods menu with breakfast favorites, sandwiches, salads, and desserts." />
      </Head>

      <main className="page">
        <NavBar />

        <section className="section">
          <h2>Full menu</h2>
          <p>Enjoy our full collection of breakfast favorites, hand-pressed sandwiches, hearty plates, and sweet treats.</p>
          <div className="menu-grid">
            <article className="menu-card">
              <h3>Breakfast</h3>
              <div className="menu-item"><span>Avocado Toast</span><span>₹14</span></div>
              <div className="menu-item"><span>Lemon Ricotta Pancakes</span><span>₹16</span></div>
              <div className="menu-item"><span>Granola Bowl</span><span>₹12</span></div>
            </article>

            <article className="menu-card">
              <h3>Sandwiches</h3>
              <div className="menu-item"><span>Smoked Turkey Club</span><span>₹18</span></div>
              <div className="menu-item"><span>Spicy Falafel Wrap</span><span>₹15</span></div>
              <div className="menu-item"><span>Grilled Chicken Panini</span><span>₹17</span></div>
            </article>

            <article className="menu-card">
              <h3>Salads & Bowls</h3>
              <div className="menu-item"><span>Kale Caesar</span><span>₹13</span></div>
              <div className="menu-item"><span>Roasted Beet Salad</span><span>₹14</span></div>
              <div className="menu-item"><span>Quinoa Harvest Bowl</span><span>₹16</span></div>
            </article>

            <article className="menu-card">
              <h3>Sweet treats</h3>
              <div className="menu-item"><span>Chocolate Tart</span><span>₹9</span></div>
              <div className="menu-item"><span>Berry Crumble</span><span>₹10</span></div>
              <div className="menu-item"><span>Espresso Affogato</span><span>₹8</span></div>
            </article>
          </div>
        </section>

        <footer className="footer">
          <p>Find the perfect dish for breakfast, lunch, or a cozy snack.</p>
        </footer>
      </main>
    </>
  );
}
