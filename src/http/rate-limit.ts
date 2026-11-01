/** 制限を超えたときに待たせる秒数。バインディングの period（60 秒）に合わせる */
const RETRY_AFTER_SECONDS = 60;

/**
 * 接続元 IP ごとにリクエストを数え、上限を超えていれば 429 を返す。
 * 数えるのは Cloudflare のデータセンターごとで厳密ではないが、総当たりや大量登録を抑えるには足りる
 */
export async function rateLimitByIp(
  limiter: RateLimit,
  request: Request,
): Promise<Response | undefined> {
  // Cloudflare を経由しないローカルの開発サーバーではヘッダーがないため、まとめて数える
  const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await limiter.limit({ key });
  if (success) return undefined;
  return Response.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(RETRY_AFTER_SECONDS) } },
  );
}
