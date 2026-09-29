export function authOrigin(env = process.env): string {
  const value = env.APP_ORIGIN || (env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && local && url.protocol === "http:"))) {
    throw new Error("Configure a trusted APP_ORIGIN");
  }
  return url.origin;
}
