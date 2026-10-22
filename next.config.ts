import type { NextConfig } from "next";

// React's development build uses eval() to rebuild callstacks across
// environments; without 'unsafe-eval' every dev page logs a CSP error and
// shows the "1 Issue" overlay. Production React never calls eval(), so
// the production policy stays strict.
const SCRIPT_SRC =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const SECURITY_HEADERS = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    // Next.js hydration and RSC need inline scripts, and Tailwind/ui uses
    // inline styles, so 'unsafe-inline' is required there. Still blocks
    // all external script/style/frame/object origins and form-action to
    // other origins.
    key: "Content-Security-Policy",
    value: `default-src 'self'; ${SCRIPT_SRC}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
          ...SECURITY_HEADERS,
        ],
      },
    ];
  },
};

export default nextConfig;
