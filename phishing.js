/*
 * 피싱 탐지기 (텍스트/URL 패턴 기반 규칙 분석기)
 * 실제로 사이트에 접속하거나 전화를 걸어 확인하지는 않는다 — 정적 사이트에서는
 * 임의의 사이트에 자동 접속하는 것이 기술적으로 어렵고 보안상 위험할 수 있기 때문이다.
 * 대신 본문/URL/번호에 나타나는 잘 알려진 피싱 패턴을 찾아 위험도를 알려준다.
 */

const SAMPLE_EMAIL = `[국민은행] 고객님의 계좌가 비정상 접근으로 일시 정지되었습니다.
24시간 이내에 본인확인을 완료하지 않으면 계좌가 영구 정지됩니다.
아래 링크에서 즉시 본인확인을 진행해주세요.
https://kbstar-verify-account.xyz/login

인증을 위해 계좌번호와 보안카드 번호, 비밀번호를 입력해주세요.
감사합니다.`;

const SAMPLE_URL = "http://naver-login-secure.xyz/verify?user=123";
const SAMPLE_PHONE = "070-1234-5678";

const BRANDS = [
  { name: "네이버", keys: ["네이버", "naver"], domain: "naver.com" },
  { name: "카카오", keys: ["카카오", "kakao"], domain: "kakao.com" },
  { name: "토스", keys: ["토스", "toss"], domain: "toss.im" },
  { name: "쿠팡", keys: ["쿠팡", "coupang"], domain: "coupang.com" },
  { name: "국민은행", keys: ["국민은행", "kb국민은행", "kbstar"], domain: "kbstar.com" },
  { name: "우체국", keys: ["우체국", "epost"], domain: "epost.go.kr" },
  { name: "배달의민족", keys: ["배달의민족", "배민", "baemin"], domain: "baemin.com" },
  { name: "당근마켓", keys: ["당근마켓", "당근", "daangn"], domain: "daangn.com" },
  { name: "애플", keys: ["애플", "apple"], domain: "apple.com" },
  { name: "구글", keys: ["구글", "google"], domain: "google.com" },
  { name: "페이팔", keys: ["페이팔", "paypal"], domain: "paypal.com" },
];

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "is.gd", "buff.ly", "goo.gl", "url.kr"];
const SUSPICIOUS_TLDS = [".xyz", ".top", ".club", ".gq", ".cf", ".tk", ".work", ".click", ".link", ".info"];

function reason(level, text) {
  return { level, text };
}

/* ---------- 이메일 본문 분석 ---------- */
function analyzeEmail(text) {
  const reasons = [];
  let score = 0;

  const urgencyWords = ["즉시", "긴급", "24시간", "계정이 정지", "계정 정지", "영구 정지", "최종 경고", "마지막 안내", "오늘까지"];
  const foundUrgency = urgencyWords.filter((w) => text.includes(w));
  if (foundUrgency.length) {
    score += 3;
    reasons.push(reason("danger", `긴급성을 강조하는 문구가 있어요 (${foundUrgency.join(", ")}). 정상적인 기관은 보통 이런 식으로 압박하지 않아요.`));
  }

  const sensitiveWords = ["비밀번호", "주민등록번호", "보안카드", "otp", "계좌번호", "카드번호", "인증번호를 입력", "인증번호를 알려"];
  const foundSensitive = sensitiveWords.filter((w) => text.toLowerCase().includes(w.toLowerCase()));
  if (foundSensitive.length) {
    score += 4;
    reasons.push(reason("danger", `민감한 개인정보(${foundSensitive.join(", ")})를 직접 입력하거나 알려달라고 요구해요. 정상적인 기관은 이메일/문자로 이런 정보를 요구하지 않아요.`));
  }

  const rewardWords = ["당첨", "경품", "무료 상품권", "무료 쿠폰"];
  const foundReward = rewardWords.filter((w) => text.includes(w));
  if (foundReward.length) {
    score += 2;
    reasons.push(reason("warning", `보상/당첨을 미끼로 사용하고 있어요 (${foundReward.join(", ")}).`));
  }

  if (/첨부파일|\.exe|\.zip/.test(text)) {
    score += 2;
    reasons.push(reason("warning", "실행파일/압축파일 첨부를 언급해요. 출처가 불분명하면 절대 열지 마세요."));
  }

  const urls = text.match(/https?:\/\/[^\s]+/g) || [];
  if (urls.length) {
    urls.forEach((u) => {
      const urlResult = analyzeUrl(u, false);
      if (urlResult.reasons.length) {
        score += urlResult.score;
        reasons.push(...urlResult.reasons);
      }
    });
  } else if (/https?:\/\//i.test(text) === false && /http/i.test(text)) {
    reasons.push(reason("warning", "링크 형식이 불완전해요. 원본 그대로 다시 붙여넣어보세요."));
  }

  BRANDS.forEach((brand) => {
    const mentioned = brand.keys.some((k) => text.toLowerCase().includes(k.toLowerCase()));
    if (!mentioned) return;
    const hasOfficialLink = urls.some((u) => u.toLowerCase().includes(brand.domain));
    const hasAnyLink = urls.length > 0;
    if (hasAnyLink && !hasOfficialLink) {
      score += 4;
      reasons.push(
        reason("danger", `'${brand.name}'를 사칭하는 것처럼 보이지만, 포함된 링크가 공식 도메인(${brand.domain})이 아니에요.`)
      );
    }
  });

  if (!reasons.length) {
    reasons.push(reason("safe", "뚜렷한 위험 문구나 의심스러운 링크를 찾지 못했어요. 그래도 발신자 주소는 꼭 직접 확인하세요."));
  }

  return { score, reasons };
}

/* ---------- URL 분석 ---------- */
function analyzeUrl(rawUrl, standalone = true) {
  const reasons = [];
  let score = 0;
  let urlObj;

  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;

  try {
    urlObj = new URL(withProtocol);
  } catch (e) {
    return { score: 1, reasons: [reason("warning", "올바른 URL 형식이 아니에요. 주소를 다시 확인해주세요.")] };
  }

  const host = urlObj.hostname.toLowerCase();
  const full = withProtocol.toLowerCase();

  if (urlObj.protocol !== "https:") {
    score += 1;
    reasons.push(reason("warning", "암호화되지 않은 http 연결이에요. 개인정보를 입력하기 전에 https인지 확인하세요."));
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    score += 3;
    reasons.push(reason("danger", "도메인 이름 대신 IP 주소를 직접 사용하고 있어요. 정상적인 서비스에서는 드문 형태예요."));
  }

  if (host.includes("xn--")) {
    score += 2;
    reasons.push(reason("warning", "국제화 도메인(punycode)을 사용해요. 비슷하게 생긴 다른 문자로 도메인을 위장했을 수 있어요."));
  }

  if (rawUrl.includes("@")) {
    score += 3;
    reasons.push(reason("danger", "주소에 '@' 기호가 포함되어 있어요. 실제 접속 위치를 속이는 데 자주 쓰이는 수법이에요."));
  }

  const dotCount = (host.match(/\./g) || []).length;
  if (dotCount >= 4) {
    score += 1;
    reasons.push(reason("warning", "서브도메인이 비정상적으로 많아요. 진짜 도메인이 무엇인지 다시 확인해보세요."));
  }

  const hyphenCount = (host.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    score += 1;
    reasons.push(reason("warning", "도메인에 하이픈(-)이 많이 포함되어 있어요. 공식 도메인을 흉내낸 주소일 수 있어요."));
  }

  if (SUSPICIOUS_TLDS.some((tld) => host.endsWith(tld))) {
    score += 2;
    reasons.push(reason("warning", `'${host.slice(host.lastIndexOf("."))}' 최상위 도메인은 스팸/피싱 사이트에 자주 사용돼요.`));
  }

  if (SHORTENERS.some((s) => host === s || host.endsWith("." + s))) {
    score += 1;
    reasons.push(reason("warning", "단축 URL이라 실제 목적지 주소를 미리 알 수 없어요. 클릭 전 목적지를 확인하는 것이 안전해요."));
  }

  BRANDS.forEach((brand) => {
    const looksLikeBrand = brand.keys.some((k) => host.includes(k.toLowerCase().replace(/\s/g, "")));
    const isOfficial = host === brand.domain || host.endsWith("." + brand.domain);
    if (looksLikeBrand && !isOfficial) {
      score += 4;
      reasons.push(
        reason("danger", `'${brand.name}' 공식 도메인(${brand.domain})처럼 보이지만 실제로는 일치하지 않아요.`)
      );
    }
  });

  if (standalone && !reasons.length) {
    reasons.push(reason("safe", "뚜렷한 위험 신호를 찾지 못했어요. 그래도 처음 방문하는 사이트에는 개인정보 입력을 신중히 하세요."));
  }

  return { score, reasons };
}

/* ---------- 전화번호 분석 (참고용) ---------- */
function analyzePhone(raw) {
  const reasons = [];
  let score = 0;
  const digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("070")) {
    score += 2;
    reasons.push(reason("warning", "070은 인터넷 전화번호예요. 보이스피싱에 자주 악용되는 번호 유형이니 발신자를 신중히 확인하세요."));
  } else if (digits.startsWith("+") && !digits.startsWith("+82")) {
    score += 2;
    reasons.push(reason("warning", "국내(+82)가 아닌 해외 발신 번호예요. 국내 기관을 사칭한 해외발 피싱일 수 있어요."));
  } else if (digits.startsWith("050")) {
    reasons.push(reason("safe", "050으로 시작하는 번호는 실제 번호를 보호하기 위한 안심번호 형식이에요. 정식 서비스에서 사용하는지 확인해보세요."));
  } else if (/^01[016789]\d{7,8}$/.test(digits)) {
    reasons.push(reason("safe", "일반 휴대전화 번호 형식이에요. 공공기관·금융기관은 보통 대표번호(예: 1588, 1600 등)를 사용해요."));
  } else if (digits.length < 8 || digits.length > 13) {
    score += 1;
    reasons.push(reason("warning", "전화번호 형식이 올바르지 않은 것 같아요. 다시 확인해주세요."));
  }

  if (!reasons.length) {
    reasons.push(reason("safe", "형식만으로는 특별한 위험 패턴을 찾지 못했어요."));
  }

  return { score, reasons };
}

/* ---------- 렌더링 ---------- */
function classify(score, mode) {
  if (mode === "phone") {
    if (score >= 2) return { cls: "warning", icon: "⚠️", label: "주의가 필요한 번호 패턴이에요" };
    return { cls: "warning", icon: "ℹ️", label: "패턴만으로는 확신하기 어려워요 — 꼭 공식 채널로 재확인하세요" };
  }
  if (score >= 6) return { cls: "danger", icon: "🚨", label: "피싱 위험이 높아요 — 링크 클릭이나 정보 입력을 하지 마세요" };
  if (score >= 3) return { cls: "warning", icon: "⚠️", label: "의심스러운 신호가 발견됐어요 — 주의하세요" };
  return { cls: "safe", icon: "✅", label: "뚜렷한 위험 신호를 찾지 못했어요" };
}

function renderResult(score, reasons, mode) {
  const wrap = document.getElementById("phishing-result-wrap");
  wrap.classList.add("visible");

  const v = classify(score, mode);
  document.getElementById("phishing-verdict-banner").className = `verdict-banner ${v.cls}`;
  document.getElementById("phishing-verdict-icon").textContent = v.icon;
  document.getElementById("phishing-verdict-label").textContent = v.label;
  document.getElementById("phishing-verdict-score").textContent = `위험 신호 ${reasons.filter((r) => r.level !== "safe").length}건 발견`;

  document.getElementById("phishing-reason-list").innerHTML = reasons
    .map((r) => {
      const icon = r.level === "danger" ? "🚨" : r.level === "warning" ? "⚠️" : "✅";
      return `<div class="reason-item flag-${r.level}"><span class="r-icon">${icon}</span><span>${r.text}</span></div>`;
    })
    .join("");

  if (mode === "phone") {
    document.getElementById("phishing-official-check").style.display = "block";
  } else {
    document.getElementById("phishing-official-check").style.display = "none";
  }

  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- 탭 UI ---------- */
function setupTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
      document.getElementById("phishing-result-wrap").classList.remove("visible");
    });
  });
}

function init() {
  setupTabs();

  document.getElementById("email-sample-btn").addEventListener("click", () => {
    document.getElementById("email-input").value = SAMPLE_EMAIL;
  });
  document.getElementById("url-sample-btn").addEventListener("click", () => {
    document.getElementById("url-input").value = SAMPLE_URL;
  });
  document.getElementById("phone-sample-btn").addEventListener("click", () => {
    document.getElementById("phone-input").value = SAMPLE_PHONE;
  });

  document.getElementById("email-analyze-btn").addEventListener("click", () => {
    const text = document.getElementById("email-input").value.trim();
    if (!text) return;
    const { score, reasons } = analyzeEmail(text);
    renderResult(score, reasons, "email");
  });

  document.getElementById("url-analyze-btn").addEventListener("click", () => {
    const url = document.getElementById("url-input").value.trim();
    if (!url) return;
    const { score, reasons } = analyzeUrl(url, true);
    renderResult(score, reasons, "url");
  });

  document.getElementById("phone-analyze-btn").addEventListener("click", () => {
    const phone = document.getElementById("phone-input").value.trim();
    if (!phone) return;
    const { score, reasons } = analyzePhone(phone);
    renderResult(score, reasons, "phone");
  });
}

init();
