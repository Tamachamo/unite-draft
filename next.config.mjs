/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'unite-db.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
