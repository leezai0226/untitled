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
    `${GRAPH}/${igUserId}/subscribed_apps?subscribed_fields=comments,messages,messaging_postbacks&access_token=${encodeURIComponent(token)}`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`웹훅 구독 실패: ${JSON.stringify(data)}`);
  }
}

/* ── 댓글 비공개 답장 (Private Reply) ──
 * 텍스트 전용 또는 버튼 템플릿(본문 최대 640자 + 버튼 1~2개) 1건 발송.
 * Meta 정책상 댓글 1개당 비공개 답장은 1회만 가능.
 */
export interface DmButton {
  label: string;
  url?: string;      // web_url 버튼
  payload?: string;  // postback 버튼 (버튼 클릭 웹훅 수신)
}

function buildMessage(
  text: string,
  buttons?: DmButton[]
): Record<string, unknown> {
  const valid = (buttons ?? []).filter((b) => b.label && (b.url || b.payload));
  if (valid.length === 0) return { text: text.slice(0, 1000) };
  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: text.slice(0, 640),
        buttons: valid.slice(0, 3).map((b) =>
          b.url
            ? { type: "web_url", url: b.url, title: b.label.slice(0, 20) }
            : {
                type: "postback",
                payload: b.payload,
                title: b.label.slice(0, 20),
              }
        ),
      },
    },
  };
}

async function postMessage(
  igUserId: string,
  token: string,
  body: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${GRAPH}/${igUserId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(
      `DM 발송 실패: ${data.error?.message || JSON.stringify(data)}`
    );
  }
}

export async function sendPrivateReply(input: {
  igUserId: string;
  token: string;
  commentId: string;
  text: string;
  buttons?: DmButton[];
}): Promise<void> {
  await postMessage(input.igUserId, input.token, {
    recipient: { comment_id: input.commentId },
    message: buildMessage(input.text, input.buttons),
  });
}

/* ── 대화창으로 직접 DM (버튼 클릭 후속 발송 등 24시간 창 내) ── */
export async function sendDirectMessage(input: {
  igUserId: string;
  token: string;
  recipientId: string; // IG-scoped user id
  text: string;
  buttons?: DmButton[];
}): Promise<void> {
  await postMessage(input.igUserId, input.token, {
    recipient: { id: input.recipientId },
    message: buildMessage(input.text, input.buttons),
  });
}

/* ── 댓글에 공개 답글 달기 ── */
export async function replyToComment(
  commentId: string,
  token: string,
  message: string
): Promise<void> {
  const res = await fetch(`${GRAPH}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message.slice(0, 300), access_token: token }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(
      `공개 답글 실패: ${data.error?.message || JSON.stringify(data)}`
    );
  }
}

/* ── 댓글 작성자의 팔로우 여부 조회 ──
 * 조회 실패 시 null (판단 불가 → 발송 쪽으로 fail-open 권장)
 */
export async function checkUserFollowsBusiness(
  igScopedUserId: string,
  token: string
): Promise<boolean | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${igScopedUserId}?fields=is_user_follow_business&access_token=${encodeURIComponent(token)}`
    );
    const data = await res.json();
    if (!res.ok || data.error) {
      console.warn("[instagram] 팔로우 조회 실패:", JSON.stringify(data));
      return null;
    }
    if (typeof data.is_user_follow_business === "boolean") {
      return data.is_user_follow_business;
    }
    console.warn("[instagram] 팔로우 필드 없음:", JSON.stringify(data));
    return null;
  } catch (err) {
    console.warn("[instagram] 팔로우 조회 오류:", err);
    return null;
  }
}

/* ── 내 최근 게시물 목록 (게시물 선택 UI용) ── */
export interface IgMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

export async function fetchRecentMedia(
  token: string,
  limit = 30
): Promise<IgMedia[]> {
  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    limit: String(limit),
    access_token: token,
  });
  const res = await fetch(`${GRAPH}/me/media?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(
      `게시물 조회 실패: ${data.error?.message || JSON.stringify(data)}`
    );
  }
  return (data.data ?? []) as IgMedia[];
}
