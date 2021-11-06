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
        Here&lsquo;s a fuel tracker
        <FuelList />
      </main>
    </div>
  );
};

export default Home;
