import Head from 'next/head';
import NavBar from '../components/NavBar';

export default function About() {
  return (
    <>
      <Head>
        <title>About | Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="About Paranjape Foods - our story, values, and kitchen philosophy." />
      </Head>

      <main className="page">
        <NavBar />

        <section className="section">
          <h2>About us</h2>
          <p>Paranjape Foods began as a kitchen where fresh ingredients, warm hospitality, and authentic comfort food come together.</p>
          <div className="menu-card">
            <h3>Our story</h3>
            <p>We believe in seasonal menus, thoughtful sourcing, and meals that feel familiar yet exciting. Every recipe is designed to bring families and friends together with delicious food.</p>
          </div>
        </section>

        <section className="section">
          <h2>What we care about</h2>
          <div className="info-grid">
            <article className="info-card">
              <h3>Local ingredients</h3>
              <p>We support nearby farms and authentic spice suppliers so every dish stays bright, fresh, and crafted with care.</p>
            </article>
            <article className="info-card">
              <h3>Quality service</h3>
              <p>Friendly, fast, and attentive service is part of every order, whether you're dining in or ordering online for home delivery.</p>
            </article>
          </div>
        </section>

        <footer className="footer">
          <p>Discover the flavor behind every dish at Paranjape Foods.</p>
        </footer>
      </main>
    </>
  );
}
