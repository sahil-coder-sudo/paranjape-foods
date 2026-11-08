import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#ec2227" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
