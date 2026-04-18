/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'unite-db.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com', // 💡 PokeAPIの高画質画像を許可
      },
    ],
  },
};

export default nextConfig;
