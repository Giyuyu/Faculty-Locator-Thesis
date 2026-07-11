import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Hero from './Hero';
import Highlight from './Highlight';
import About from './About';
import Footer from '../../components/layout/Footer';

function Landing() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const target = document.getElementById(location.hash.replace('#', ''));
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Hero />
      <Highlight />
      <About />
      <Footer />
    </div>
  );
}

export default Landing;
