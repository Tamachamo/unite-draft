/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScriptの型エラーがあっても、強制的にビルドを完了させる設定
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLintの文法エラーがあっても、強制的にビルドを完了させる設定
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['unite-db.com'],
  },
}

module.exports = nextConfig
