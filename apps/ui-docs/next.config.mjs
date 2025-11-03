/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    'eventsource-parser',
    'ai',
    '@ai-sdk/react',
  ],
  async rewrites() {
    const origin = process.env.FORMLINK_BACKEND_ORIGIN || 'http://localhost:3001';
    return [
      {
        source: '/api/ai/chat-assist',
        destination: `${origin}/api/ai/chat-assist`,
      },
      {
        source: '/api/upload',
        destination: `${origin}/api/upload`,
      },
      {
        source: '/api/forms/:formId',
        destination: `${origin}/api/forms/:formId`,
      },
    ];
  },
};

export default nextConfig;
