/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Sample-listing photos for the receipt demo, served from the app's
    // public Supabase bucket and resized by Next.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nmmbktcqjznwdddwqxad.supabase.co",
        pathname: "/storage/v1/object/public/room-photos/**",
      },
    ],
  },
};

export default nextConfig;
