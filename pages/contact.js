import Head from 'next/head';
import NavBar from '../components/NavBar';

export default function Contact() {
  return (
    <>
      <Head>
        <title>Contact | Paranjape Foods</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Contact Paranjape Foods for reservations, catering, and menu inquiries." />
      </Head>

      <main className="page">
        <NavBar />

        <section className="section">
          <h2>Contact</h2>
          <p>Reach out for reservations, private brunch plans, and quick menu questions.</p>
          <div className="menu-card">
            <h3>Get in touch</h3>
            <p>123 Garden Street, Suite 5<br />Sunrise City</p>
            <p>Phone: <a href="tel:+15551234567">(555) 123-4567</a><br />Email: <a href="mailto:hello@sunrisebistro.example">hello@sunrisebistro.example</a></p>
          </div>
        </section>

        <section className="section">
          <div className="info-grid">
            <article className="info-card">
              <h3>Hours</h3>
              <p>Mon–Fri 7:30am–3:00pm<br />Sat–Sun 8:00am–4:00pm</p>
            </article>
            <article className="info-card">
              <h3>Reservations</h3>
              <p>Call or message us for weekend brunch seating and larger group orders.</p>
            </article>
          </div>
        </section>

        <footer className="footer">
          <p>We look forward to serving you soon.</p>
        </footer>
      </main>
    </>
  );
}
