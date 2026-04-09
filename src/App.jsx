import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const CAPTION_PROMPT = `당신은 인스타그램 매거진 계정의 에디터입니다.
광고주가 보내온 소스(가이드, 브리프, 보도자료 등)를 받으면 아래 조건에 맞게 캡션을 작성합니다.

[캡션 형식]
- 첫 줄: 한 문장 훅 + 이모지 1개 (강렬하고 간결하게)
- 본문: 본문 초반에는 가장 사람들이 본능적으로 관심을 가질만한 내용을 배치. 3~4개 단락, 각 단락 3~4줄 이내
- 각 단락 마지막에 맥락에 맞는 이모지 1개
- 후반 단락: 현재 상황 또는 수치로 마무리
- 마지막 단락: 이 내용에 대한 객관적인 사람들이 필요할 정보를 리스트업이나 보기좋게 정리

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
4. 현재 상황 + 수치`;

const TITLE_PROMPT = `당신은 인기 제목의 '구조'를 참고하여, 사용자가 전달한 콘텐츠 재료를 분석 후 인스타 콘텐츠 썸네일 제목을 짓는 봇입니다. (팩트에 기반해야 함)

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
- 호기심 유발형: "~하는 이유", "~의 정체"`;

const SYSTEM_PROMPT = `${CAPTION_PROMPT}

또한 썸네일 제목도 함께 제안합니다.
${TITLE_PROMPT}

반드시 아래 JSON으로만 응답. 다른 텍스트 없이:
{
  "brand": "브랜드/행사명",
  "caption": "피드 캡션 전문 (위 형식대로 작성)",
  "titles": [
    "썸네일 제목 안 1",
    "썸네일 제목 안 2",
    ... (20개)
  ],
  "info": {
    "date": "일시 (없으면 null)",
    "location": "장소 (없으면 null)",
    "link": "링크 (없으면 null)",
    "hashtags": ["해시태그1", "해시태그2"],
    "mentions": ["@계정1"]
  }
}`;

const GOOGLE_CLIENT_ID = window.__GOOGLE_CLIENT_ID__ || "";
const ALLOWED_DOMAIN = "curationclub.kr";

// ─── Auth component ───
function LoginScreen({ onLogin }) {
  const btnRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          const payload = JSON.parse(atob(response.credential.split(".")[1]));
          if (payload.hd === ALLOWED_DOMAIN || payload.email?.endsWith("@" + ALLOWED_DOMAIN)) {
            localStorage.setItem("cc_user", JSON.stringify({ name: payload.name, email: payload.email, picture: payload.picture }));
            onLogin({ name: payload.name, email: payload.email, picture: payload.picture });
          } else {
            alert("@curationclub.kr 계정만 사용할 수 있습니다.");
          }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "filled_black",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 300,
      });
    };
    document.head.appendChild(script);
  }, [onLogin]);

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Pretendard',sans-serif" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #0c0c0b; margin: 0; }
      `}</style>
      <div style={{ width:32, height:32, borderRadius:8, background:"#c8ff00", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:"#0c0c0b", fontFamily:"'DM Mono',monospace", marginBottom:16 }}>C</div>
      <div style={{ fontSize:20, fontWeight:800, color:"#f0f0ec", marginBottom:6, letterSpacing:"-0.3px" }}>AD PRODUCER</div>
      <div style={{ fontSize:12, color:"#3a3a36", fontFamily:"'DM Mono',monospace", marginBottom:40 }}>curationclub.kr 팀 전용</div>
      <div ref={btnRef} />
      {!GOOGLE_CLIENT_ID && (
        <div style={{ marginTop:20, padding:"12px 20px", background:"#2e1a1a", border:"1px solid #5a2d2d", borderRadius:10, color:"#d4a0a0", fontSize:12, maxWidth:340, textAlign:"center" }}>
          Google Client ID가 설정되지 않았습니다.
        </div>
      )}
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("cc_user");
    return saved ? JSON.parse(saved) : null;
  });

  if (!user) return <LoginScreen onLogin={setUser} />;

  return <MainApp user={user} onLogout={() => { localStorage.removeItem("cc_user"); setUser(null); }} />;
}

function MainApp({ user, onLogout }) {
  const [guideText, setGuideText] = useState("");
  const [guideFile, setGuideFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState("");
  const [phase, setPhase] = useState("input");
  const guideFileRef = useRef(null);

  const readFileAsText = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve("[파일 읽기 실패]");
      reader.readAsText(file);
    });

  const readPdf = async (file) => {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n\n");
  };

  const readOfficeXml = async (file) => {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const ext = file.name.split(".").pop().toLowerCase();
    const texts = [];
    if (ext === "pptx") {
      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1]) - parseInt(b.match(/slide(\d+)/)[1]));
      for (const sf of slideFiles) {
        const xml = await zip.file(sf).async("text");
        const stripped = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (stripped) texts.push(stripped);
      }
    } else if (ext === "docx") {
      const doc = zip.file("word/document.xml");
      if (doc) {
        const xml = await doc.async("text");
        texts.push(xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      }
    }
    return texts.join("\n\n") || "[내용 추출 실패]";
  };

  const readGuideFile = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["txt", "md", "csv", "json", "html"].includes(ext)) return readFileAsText(file);
    if (ext === "pdf") return readPdf(file);
    if (["pptx", "docx"].includes(ext)) return readOfficeXml(file);
    return `[지원하지 않는 형식: ${ext}]`;
  };

  const handleGuideFile = (e) => {
    const f = e.target.files[0];
    if (f) setGuideFile(f);
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      let fullText = guideText;
      if (guideFile) {
        const fileText = await readGuideFile(guideFile);
        fullText = fileText + (guideText ? "\n\n" + guideText : "");
      }
      if (!fullText.trim()) {
        setError("가이드 텍스트를 입력하거나 파일을 첨부해주세요.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/anthropic/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `아래는 광고주가 보내온 가이드 원문이야. 이걸 기반으로 캡션과 썸네일 제목을 만들어줘.\n\n---\n${fullText}\n---` }],
        }),
      });

      const data = await response.json();
      if (data.type === "error") {
        setError(`API 오류: ${data.error?.message || JSON.stringify(data.error)}`);
        setLoading(false);
        return;
      }

      const text = data.content.map((item) => (item.type === "text" ? item.text : "")).filter(Boolean).join("");
      const clean = text.replace(/```json|```/g, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch {
        const fixed = clean.replace(/(?<=:\s*")([\s\S]*?)(?="(?:\s*[,}\]]))/g, (m) =>
          m.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")
        );
        parsed = JSON.parse(fixed);
      }
      setResult(parsed);
      setPhase("result");
    } catch (err) {
      console.error(err);
      setError(`생성 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text, label) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); }
    setCopied(label);
    setTimeout(() => setCopied(""), 1800);
  };

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "24px 16px 60px", fontFamily: "'Pretendard', sans-serif" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #0c0c0b; margin: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        ::placeholder { color: #3a3a36; }
        textarea:focus, input:focus { outline:none; border-color: #c8ff00 !important; }
        ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:#2a2a26; border-radius:3px; }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:"#c8ff00", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:"#0c0c0b", fontFamily:"'DM Mono',monospace" }}>C</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:"#f0f0ec", letterSpacing:"-0.3px" }}>AD PRODUCER</div>
            <div style={{ fontSize:10, color:"#3a3a36", fontFamily:"'DM Mono',monospace" }}>파일 던지면 끝</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img src={user.picture} alt="" style={{ width:24, height:24, borderRadius:12 }} />
          <span style={{ fontSize:11, color:"#6a6a64" }}>{user.name}</span>
          <button onClick={onLogout} style={{ ...btnGhost, fontSize:10 }}>로그아웃</button>
        </div>
      </div>

      {phase === "input" && (
        <div style={{ animation:"fadeUp .4s ease" }}>
          <label style={lbl}>광고주 가이드</label>
          <div
            onClick={() => guideFileRef.current?.click()}
            style={{
              border: "1.5px dashed #2a2a26", borderRadius:14, padding:"28px 20px", textAlign:"center",
              cursor:"pointer", marginBottom: guideFile ? 8 : 0, transition:"border .2s",
              background: guideFile ? "#c8ff0006" : "transparent",
              borderColor: guideFile ? "#c8ff0030" : "#2a2a26",
            }}
          >
            <input ref={guideFileRef} type="file" accept=".txt,.md,.pdf,.doc,.docx,.pptx,.html,.csv,.json" onChange={handleGuideFile} style={{ display:"none" }} />
            {guideFile ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <span style={{ fontSize:13, color:"#c8ff00", fontWeight:600 }}>{guideFile.name}</span>
                <button onClick={(e)=>{e.stopPropagation(); setGuideFile(null);}} style={{ background:"none", border:"none", color:"#5a5a54", cursor:"pointer", fontSize:16 }}>×</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize:28, marginBottom:8 }}>📄</div>
                <div style={{ fontSize:13, color:"#6a6a64" }}>가이드 파일 첨부</div>
                <div style={{ fontSize:11, color:"#3a3a36", marginTop:4 }}>txt, pdf, pptx, docx — 또는 아래에 직접 붙여넣기</div>
              </>
            )}
          </div>

          <textarea
            value={guideText}
            onChange={(e) => setGuideText(e.target.value)}
            placeholder="또는 여기에 광고주 맨션/가이드 텍스트를 통째로 붙여넣기"
            rows={4}
            style={{ ...inp, marginTop:10, resize:"vertical", minHeight:80 }}
          />

          {error && <div style={{ marginTop:12, padding:"10px 14px", background:"#2e1a1a", border:"1px solid #5a2d2d", borderRadius:10, color:"#d4a0a0", fontSize:12 }}>{error}</div>}

          <button
            onClick={generate}
            disabled={loading || (!guideText.trim() && !guideFile)}
            style={{
              width:"100%", marginTop:24, padding:"16px", borderRadius:12, border:"none",
              background: loading || (!guideText.trim() && !guideFile) ? "#1a1a18" : "#c8ff00",
              color: loading || (!guideText.trim() && !guideFile) ? "#3a3a36" : "#0c0c0b",
              fontSize:15, fontWeight:800, cursor: loading ? "wait" : "pointer",
              fontFamily:"'Pretendard',sans-serif", letterSpacing:"-0.3px", transition:"all .3s",
            }}
          >
            {loading ? "AI가 읽는 중..." : "생성 →"}
          </button>
        </div>
      )}

      {phase === "result" && result && (
        <div style={{ animation:"fadeUp .4s ease" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <div style={{ fontSize:11, color:"#6a6a64", fontFamily:"'DM Mono',monospace", marginBottom:4 }}>{result.titles?.length || 0} TITLES</div>
              <div style={{ fontSize:20, fontWeight:800, color:"#f0f0ec", letterSpacing:"-0.5px" }}>{result.brand}</div>
            </div>
            <button onClick={()=>{ setPhase("input"); setResult(null); }} style={{ ...btnGhost, fontSize:12 }}>← 다시</button>
          </div>

          {/* Caption */}
          <div style={{ background:"#161614", border:"1px solid #222220", borderRadius:14, padding:"18px 20px", marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:10, fontWeight:700, color:"#4a4a44", fontFamily:"'DM Mono',monospace", letterSpacing:"1px" }}>CAPTION</span>
              <button onClick={() => copyText(result.caption, "caption")} style={btnGhost}>{copied==="caption" ? "✓" : "복사"}</button>
            </div>
            <p style={{ fontSize:14, color:"#d0d0ca", lineHeight:1.8, margin:0, whiteSpace:"pre-wrap", fontFamily:"'Pretendard',sans-serif" }}>{result.caption}</p>
          </div>

          {/* Info */}
          {result.info && (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
              {result.info.date && <span style={tag}>📅 {result.info.date}</span>}
              {result.info.location && <span style={tag}>📍 {result.info.location}</span>}
              {result.info.link && <span style={tag}>🔗 {result.info.link}</span>}
              {result.info.mentions?.map((m,i)=> <span key={i} style={tag}>{m}</span>)}
              {result.info.hashtags?.map((h,i)=> <span key={i} style={{...tag, color:"#c8ff00", borderColor:"#c8ff0030"}}>#{h}</span>)}
            </div>
          )}

          {/* Titles */}
          <div style={{ marginBottom:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:10, fontWeight:700, color:"#4a4a44", fontFamily:"'DM Mono',monospace", letterSpacing:"1px" }}>썸네일 제목 제안</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {(result.titles || []).map((t, i) => (
                <div
                  key={i}
                  onClick={() => copyText(t, "title-" + i)}
                  style={{
                    background:"#111110", border:"1.5px solid #1e1e1c", borderRadius:10,
                    padding:"10px 14px", cursor:"pointer", display:"flex", gap:10, alignItems:"center",
                    transition:"all .2s",
                  }}
                >
                  <div style={{ minWidth:22, height:22, borderRadius:6, background:"#1e1e1c", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#6a6a64", fontFamily:"'DM Mono',monospace" }}>{i+1}</div>
                  <span style={{ fontSize:13, color:"#c0c0ba", fontFamily:"'Pretendard',sans-serif", flex:1 }}>{t}</span>
                  <span style={{ fontSize:10, color:"#3a3a36" }}>{copied===("title-"+i) ? "✓" : "복사"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display:"block", fontSize:10, fontWeight:700, color:"#4a4a44", marginBottom:8, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace" };
const inp = { width:"100%", boxSizing:"border-box", padding:"12px 16px", border:"1.5px solid #1e1e1c", borderRadius:10, fontSize:14, fontFamily:"'Pretendard',sans-serif", lineHeight:1.6, background:"#111110", color:"#f0f0ec", outline:"none" };
const btnGhost = { padding:"4px 12px", borderRadius:8, border:"1px solid #2a2a26", background:"transparent", color:"#6a6a64", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'Pretendard',sans-serif" };
const tag = { fontSize:11, color:"#8a8a84", background:"#161614", border:"1px solid #222220", padding:"4px 10px", borderRadius:20, fontFamily:"'Pretendard',sans-serif", whiteSpace:"nowrap" };
