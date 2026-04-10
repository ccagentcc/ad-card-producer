import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import crypto from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Load .env (hosting services set env vars directly, this is fallback)
try {
  const envContent = readFileSync(resolve(__dirname, ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || "curationclub2026";
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
const ALLOWED_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_LIMIT = 4000;

// Simple token store (in production, use JWT or similar)
const validTokens = new Set();

// ─── System prompt (server-side only, not exposed to client) ───
const CAPTION_PROMPT = `당신은 인스타그램 매거진 계정의 에디터입니다.
광고주가 보내온 소스(가이드, 브리프, 보도자료 등)를 받으면 아래 조건에 맞게 캡션을 작성합니다.

[캡션 형식]
- 첫 줄: 한 문장 훅 + 이모지 1개 (강렬하고 간결하게)
- 본문: 본문 초반에는 가장 사람들이 본능적으로 관심을 가질만한 내용을 배치. 3~4개 단락, 각 단락 3~4줄 이내
- 각 단락 마지막에 맥락에 맞는 이모지 1개
- 후반 단락: 현재 상황 또는 수치로 마무리
- 마지막 단락: 이 내용에 대한 객관적인 사람들이 필요할 정보를 리스트업이나 보기좋게 정리
- 캡션 최하단에 반드시 아래 마감 문구를 그대로 붙일 것:

@curation_club 팔로우하고,
진짜 영감이 될 콘텐츠를 놓치지마세요.

-
Curator
⁂Inspire Everyday

[문체]
- 서머셋 몸의 글쓰기원칙을 지킴
- 구어체와 뉴스체 혼합 (~입니다/~인데요/~죠 등 자연스러운 뉴스체 + 존대어)
- 구체적인 숫자/날짜/데이터 포함
- 대립/갈등/반전/충격 구도가 있으면 강조
- 모르는 사람들도 이해할 수 있는 맥락 사용 (글 전반적으로)

[내용 구성 순서]
1. 핵심 사실 (무슨 일이 일어났는가)
2. 원인/배경 설명
3. 전개 과정
4. 현재 상황 + 수치

또한 썸네일 제목도 함께 제안합니다.
당신은 인기 제목의 '구조'를 참고하여, 사용자가 전달한 콘텐츠 재료를 분석 후 인스타 콘텐츠 썸네일 제목을 짓는 봇입니다. (팩트에 기반해야 함)
미스터비스트의 SNS 썸네일 이론을 참고하여 새로운 카피라이팅 이론을 도출하고, 20개의 제목 안을 제안합니다.

[미스터비스트 썸네일 이론 핵심]
- 3초 안에 이해 가능해야 함
- 호기심 갭(Curiosity Gap): 알고 싶은데 모르는 상태를 만들 것
- 감정 트리거: 놀람, 분노, 감동, 공감 중 하나는 건드릴 것
- 구체적 숫자가 추상적 표현보다 강력
- 짧을수록 좋음. 불필요한 단어 제거

[참고 인기 제목 패턴]
- 권위 인용형: "의사들이 뽑은~", "뉴욕타임스가 선정한~"
- 반전/충격형: "26년만에 밝혀진~", "누나가 죽었다."
- 공감/실용형: "대부분 직장인들이 이해하는~", "그동안 몰랐던~"
- 서사/스토리형: "사랑하는 아내가 떠나가기까지의 기록"
- 숫자 강조형: "하루 15분만~", "수백만원 쓰면~"
- 호기심 유발형: "~하는 이유", "~의 정체"

또한 인스타그램 해시태그도 생성합니다.
[해시태그 전략 — 인스타그램 전문가 관점]
- 총 12개 해시태그 구성:
  · 대형 태그 2개 (100만+ 게시물, 노출용): 해당 주제의 가장 큰 카테고리
  · 중형 태그 4개 (10만~100만 게시물, 경쟁+노출 밸런스): 구체적 주제 키워드
  · 소형 태그 4개 (1만~10만 게시물, 탐색탭 진입용): 니치한 롱테일 키워드
  · 브랜드/채널 태그 2개: #큐레이션클럽 + 브랜드 고유 태그
- 한국어 태그 위주, 영어는 글로벌 브랜드일 때만
- 금지: #선팔 #맞팔 #좋반 등 스팸성 태그
- 콘텐츠 주제와 직접 관련 있는 태그만 (연관성이 도달률을 결정)
- 트렌딩 키워드가 있으면 우선 반영

반드시 아래 JSON으로만 응답. 다른 텍스트 없이:
{
  "brand": "브랜드/행사명",
  "caption": "피드 캡션 전문 (위 형식대로 작성)",
  "titles": ["썸네일 제목 안 1", "썸네일 제목 안 2", ... (20개)],
  "hashtags": ["해시태그1", "해시태그2", ... (12개, #없이)],
  "info": {
    "date": "일시 (없으면 null)",
    "location": "장소 (없으면 null)",
    "link": "링크 (없으면 null)",
    "mentions": ["@계정1"]
  }
}`;

// ─── Security ───────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({ origin: false }));

// Rate limiting: 10 API calls per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { type: "error", error: { message: "요청이 너무 많습니다. 1분 후 다시 시도해주세요." } },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.static(resolve(__dirname, "dist")));
app.use(express.json({ limit: "1mb" }));

// ─── Login endpoint ───
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  if (password === TEAM_PASSWORD) {
    const token = crypto.randomBytes(32).toString("hex");
    validTokens.add(token);
    // Auto-expire tokens after 7 days
    setTimeout(() => validTokens.delete(token), 7 * 24 * 60 * 60 * 1000);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false });
  }
});

// ─── Auth middleware ───
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ type: "error", error: { message: "인증이 필요합니다." } });
  }
  const token = authHeader.slice(7);
  if (!validTokens.has(token)) {
    return res.status(401).json({ type: "error", error: { message: "세션이 만료되었습니다. 다시 로그인해주세요." } });
  }
  next();
}

// ─── API Proxy (authenticated + hardcoded model/system) ───
app.post("/api/anthropic/v1/messages", apiLimiter, requireAuth, async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ type: "error", error: { message: "메시지가 필요합니다." } });
  }

  // Only allow text content from client (no arbitrary types)
  const sanitizedMessages = messages.map(m => ({
    role: m.role === "user" ? "user" : "assistant",
    content: typeof m.content === "string" ? m.content : m.content,
  }));

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ALLOWED_MODEL,
        max_tokens: MAX_TOKENS_LIMIT,
        system: CAPTION_PROMPT,
        messages: sanitizedMessages,
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ type: "error", error: { message: "서버 오류가 발생했습니다." } });
  }
});

// ─── SPA fallback ───────────────────────────────
app.get("/{*path}", (req, res) => {
  res.sendFile(resolve(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`AD PRODUCER running on http://localhost:${PORT}`);
});
