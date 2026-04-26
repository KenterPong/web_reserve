/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow lvh.me subdomains to load _next/* assets during local development
  allowedDevOrigins: ['*.lvh.me'],
}
module.exports = nextConfig
