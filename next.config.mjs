/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd275t8dp8rxb42.cloudfront.net', // 💡 CloudFrontのドメインを許可
      },
    ],
  },
};

export default nextConfig;
