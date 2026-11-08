/**
 * Wraps a page that hasn't been redesigned yet in the old navy theme (see the
 * "Legacy surface" block in app/global.css). Remove the route's layout.js that
 * uses this once the page is redesigned.
 */
export default function LegacySurface({ children }) {
  return <div className="legacy">{children}</div>;
}
