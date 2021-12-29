import type { NextPage } from 'next';
import Head from 'next/head';
import FuelList from '../components/FuelList';

const Home: NextPage = () => {
  return (
    <div className="container">
      <Head>
        <title>Fuel Tracker!</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <FuelList />
      </main>
    </div>
  );
};

export default Home;
