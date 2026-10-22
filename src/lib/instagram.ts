/**
 * Instagram API (Instagram Login 방식) 공용 헬퍼
 *
 * - OAuth: instagram.com/oauth/authorize → api.instagram.com (단기 토큰)
 *          → graph.instagram.com (장기 토큰 교환/갱신, 60일)
 * - 메시지: graph.instagram.com/{ig-user-id}/messages
 *   · 댓글 비공개 답장(Private Reply)은 댓글 1개당 1회만 가능
 * - 개발 모드: 앱에 역할(테스터)로 등록된 계정만 작동 → 내 계정 전용으로 심사 불필요
 */

const GRAPH = "https://graph.instagram.com/v23.0";

export function getInstagramEnv() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;
  return { appId, appSecret, verifyToken };
}

/* ── OAuth 인가 URL ── */
export function buildAuthorizeUrl(appId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "instagram_business_basic",
      "instagram_business_manage_messages",
      "instagram_business_manage_comments",
    ].join(","),
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/* ── code → 단기 토큰 ── */
export async function exchangeCodeForToken(input: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; user_id: string }> {
  const body = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`토큰 교환 실패: ${JSON.stringify(data)}`);
  }
  return { access_token: data.access_token, user_id: String(data.user_id) };
}

/* ── 단기 → 장기 토큰 (60일) ── */
export async function exchangeForLongLivedToken(
  appSecret: string,
  shortToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortToken,
  });
  const res = await fetch(
    `https://graph.instagram.com/access_token?${params.toString()}`
  );
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`장기 토큰 교환 실패: ${JSON.stringify(data)}`);
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

/* ── 장기 토큰 갱신 (만료 전 호출, 다시 60일) ── */
export async function refreshLongLivedToken(
  token: string
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: token,
  });
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params.toString()}`
  );
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`토큰 갱신 실패: ${JSON.stringify(data)}`);
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

/* ── 내 프로필 조회 ── */
export async function fetchProfile(
  token: string
): Promise<{ user_id: string; username: string }> {
  const res = await fetch(
    `${GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`
  );
  const data = await res.json();
  if (!res.ok || !data.username) {
    throw new Error(`프로필 조회 실패: ${JSON.stringify(data)}`);
  }
  return { user_id: String(data.user_id ?? data.id), username: data.username };
}

/* ── 웹훅 수신 구독 (comments) ── */
export async function subscribeWebhooks(
  igUserId: string,
  token: string
): Promise<void> {
  const res = await fetch(
    `${GRAPH}/${igUserId}/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(token)}`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`웹훅 구독 실패: ${JSON.stringify(data)}`);
  }
}

/* ── 댓글 비공개 답장 (Private Reply) ──
 * 텍스트 전용 또는 버튼 카드(generic template) 1건 발송.
 */
export async function sendPrivateReply(input: {
  igUserId: string;
  token: string;
  commentId: string;
  text?: string;
  card?: {
    title: string;       // 최대 80자
    subtitle?: string;   // 최대 80자
    buttonLabel: string;
    buttonUrl: string;
  };
}): Promise<void> {
  const message: Record<string, unknown> = input.card
    ? {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: input.card.title.slice(0, 80),
                ...(input.card.subtitle
                  ? { subtitle: input.card.subtitle.slice(0, 80) }
                  : {}),
                buttons: [
                  {
                    type: "web_url",
                    url: input.card.buttonUrl,
                    title: input.card.buttonLabel.slice(0, 20),
                  },
                ],
              },
            ],
          },
        },
      }
    : { text: input.text ?? "" };

  const res = await fetch(`${GRAPH}/${input.igUserId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.token}`,
    },
    body: JSON.stringify({
      recipient: { comment_id: input.commentId },
      message,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(
      `DM 발송 실패: ${data.error?.message || JSON.stringify(data)}`
    );
  }
}
