import Image from "next/image";

/** Optimize our public assets; preserve support for externally hosted images. */
export default function PublicImage({ src, alt, ...props }) {
  if (!src) return null;
  let optimize = src.startsWith("/") && !src.startsWith("//");
  try {
    const url = new URL(src);
    const storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    optimize = url.origin === storage.origin &&
      /^\/storage\/v1\/object\/public\/(staff-images|site-images)\//.test(url.pathname);
  } catch {
    // Relative paths are handled above; other sources use the original URL.
  }
  return <Image src={src} alt={alt} unoptimized={!optimize} {...props} />;
}
