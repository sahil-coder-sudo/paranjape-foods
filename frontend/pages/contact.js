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
            <p>Paranjape Foods Kitchen<br />Fresh Doorstep Delivery</p>
            <p>Phone: <a href="tel:+918355842877">+91 83558 42877</a><br />Email: <a href="mailto:paranjapefoods15@gmail.com">paranjapefoods15@gmail.com</a></p>
          </div>
        </section>

        <section className="section">
          <div className="info-grid">
            <article className="info-card">
              <h3>Hours</h3>
              <p>Mon–Fri <br />8:00am–2:00pm<br />5:30pm–9:30pm</p>
              <p>Sat–Sun <br />8:00am–2:00pm</p>
            </article>
            <article className="info-card">
              <h3>Event Orders</h3>
              <p>Call or message us for event or group orders.</p>
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
