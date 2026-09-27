const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storage = storageUrl ? new URL(storageUrl) : null;

export default {
  images: {
    // Cache optimized public photos across visitors instead of downloading
    // originals from Supabase for every page view. Use a new URL on replacement.
    minimumCacheTTL: 86400,
    remotePatterns: storage ? ["staff-images", "site-images"].map((bucket) => ({
      protocol: storage.protocol.slice(0, -1),
      hostname: storage.hostname,
      port: storage.port,
      pathname: `/storage/v1/object/public/${bucket}/**`,
    })) : [],
  },
};
