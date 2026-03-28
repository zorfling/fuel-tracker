/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline'
  }
});

module.exports = withPWA({
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'http', hostname: 'logok.org' },
      { protocol: 'https', hostname: 'logok.org' },
      { protocol: 'https', hostname: 'www.parkridgetowncentre.com.au' },
      { protocol: 'http', hostname: 'www.parkridgetowncentre.com.au' },
      { protocol: 'https', hostname: 'fuelprice.io' },
      { protocol: 'https', hostname: 'cdn.australia247.info' },
      { protocol: 'https', hostname: 'www.pacificpetroleum.com.au' },
      { protocol: 'https', hostname: 'www.kdpr.com.au' },
      { protocol: 'https', hostname: 'i.pinimg.com' },
      { protocol: 'https', hostname: 'www.libertyoil.com.au' },
      { protocol: 'https', hostname: 'metropetroleum.b-cdn.net' },
      { protocol: 'https', hostname: 'maps.gstatic.com' }
    ]
  }
});
