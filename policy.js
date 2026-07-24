/*
 * 개인정보 처리방침 번역기 (규칙 기반)
 * 실제 AI(LLM) API로 교체하려면 analyzePolicy() 안의 로직을
 * 서버리스 함수에 텍스트를 보내 요약을 받아오는 코드로 바꾸면 된다.
 */

const SAMPLE_POLICY = `제1조(수집하는 개인정보 항목)
회사는 회원가입, 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.
- 필수항목: 이름, 이메일, 휴대전화번호, 비밀번호, 아이디
- 선택항목: 생년월일, 성별, 주소
- 서비스 이용 과정에서 IP주소, 쿠키, 접속 로그, 기기정보가 자동으로 수집될 수 있습니다.

제2조(개인정보의 수집 및 이용목적)
회사는 회원 관리, 서비스 제공 및 개선, 결제 및 정산, 고객 문의 응대를 위해 개인정보를 이용합니다.

제3조(개인정보의 보유 및 이용기간)
회사는 원칙적으로 회원 탈퇴 시 지체없이 개인정보를 파기합니다. 다만 관련 법령에 따라
전자상거래 기록은 5년, 소비자 불만 처리 기록은 3년간 보관합니다.

제4조(개인정보의 제3자 제공)
회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 배송을 위해
제휴 택배사에 이름, 연락처, 주소를 제공하며, 결제 처리를 위해 결제대행사(PG사)에
결제 관련 정보를 제공합니다.

제5조(이용자의 권리)
이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요청할 수 있으며
개인정보 수집 및 이용에 대한 동의를 철회할 수 있습니다.

제6조(개인정보 보호책임자)
회사는 개인정보 보호책임자를 지정하고 있으며, 문의사항은 privacy@example.com으로
연락하시면 신속히 답변드립니다.`;

const PII_KEYWORDS = [
  "이름", "성명", "생년월일", "성별", "이메일", "전화번호", "휴대전화번호", "휴대전화",
  "휴대폰번호", "주소", "아이디", "비밀번호", "닉네임", "주민등록번호", "여권번호",
  "운전면허", "카드번호", "계좌번호", "결제정보", "접속 로그", "접속로그", "쿠키",
  "IP주소", "IP 주소", "위치정보", "기기정보", "단말기정보", "광고식별자", "사진",
  "프로필 이미지", "음성", "건강정보", "신용정보", "학교", "직업",
];

const RIGHT_KEYWORDS = ["열람", "정정", "삭제", "처리정지", "동의철회", "동의 철회", "이의제기"];

function reason(level, text) {
  return { level, text };
}

function splitLines(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}

function findSection(lines, keywords) {
  for (let i = 0; i < lines.length; i++) {
    if (keywords.some((k) => lines[i].includes(k))) {
      const context = [lines[i]];
      for (let j = i + 1; j < lines.length && context.length < 4; j++) {
        if (/^제\s*\d+\s*조/.test(lines[j])) break;
        context.push(lines[j]);
      }
      return context.join(" ").replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

function findHits(text, keywords) {
  const found = [];
  keywords.forEach((k) => {
    if (text.includes(k) && !found.includes(k)) found.push(k);
  });
  return found;
}

function findDurations(text) {
  const matches = text.match(/\d+\s*(?:년|개월|주|일)(?:간)?/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, "")))].slice(0, 8);
}

function analyzePolicy(text) {
  const lines = splitLines(text);

  const collected = findHits(text, PII_KEYWORDS);
  const retentionContext = findSection(lines, ["보유기간", "보유 기간", "보관기간", "보관 기간", "파기"]);
  const durations = findDurations(text);
  const thirdPartyContext = findSection(lines, ["제3자", "제 3자", "위탁"]);
  const purposeContext = findSection(lines, ["이용목적", "이용 목적", "수집목적", "수집 목적", "처리목적", "처리 목적"]);
  const rights = findHits(text, RIGHT_KEYWORDS);
  const contactContext = findSection(lines, ["개인정보 보호책임자", "개인정보보호책임자", "고충처리", "담당자"]);
  const overseasContext = findSection(lines, ["국외", "해외 이전", "국외 이전", "해외이전"]);
  const cookieUsed = text.includes("쿠키");

  const checklist = [
    { label: "수집하는 개인정보 항목", found: collected.length > 0 },
    { label: "보유기간 / 파기 절차", found: !!retentionContext || durations.length > 0 },
    { label: "제3자 제공 여부", found: !!thirdPartyContext },
    { label: "이용 목적", found: !!purposeContext },
    { label: "이용자 권리 (열람/정정/삭제 등)", found: rights.length > 0 },
    { label: "담당자 연락처", found: !!contactContext },
  ];

  const foundCount = checklist.filter((c) => c.found).length;

  return {
    collected,
    retentionContext,
    durations,
    thirdPartyContext,
    purposeContext,
    rights,
    contactContext,
    overseasContext,
    cookieUsed,
    checklist,
    foundCount,
  };
}

/* ---------- 짧은 요약 ---------- */
function buildShortSummary(result) {
  const parts = [];

  if (result.collected.length) {
    const shown = result.collected.slice(0, 5);
    const suffix = result.collected.length > 5 ? " 등" : "";
    parts.push(`${shown.join(", ")}${suffix}을(를) 수집해요.`);
  } else {
    parts.push("수집하는 개인정보 항목을 문서에서 찾지 못했어요.");
  }

  if (result.durations.length) {
    parts.push(`보관 기간은 ${result.durations.slice(0, 3).join(", ")} 등으로 명시되어 있어요.`);
  } else if (result.retentionContext) {
    parts.push("탈퇴 또는 목적 달성 시 파기한다고 안내하고 있어요.");
  } else {
    parts.push("보관 기간에 대한 안내는 찾지 못했어요.");
  }

  parts.push(
    result.thirdPartyContext
      ? "일부 정보는 제3자(협력업체 등)에게 제공될 수 있어요."
      : "제3자 제공에 대한 언급은 찾지 못했어요."
  );

  parts.push(
    result.rights.length
      ? `이용자는 ${result.rights.slice(0, 4).join("·")} 등을 요청할 수 있어요.`
      : "이용자 권리 행사 방법에 대한 안내는 찾지 못했어요."
  );

  return parts.join(" ");
}

/* ---------- 위험 신호 감지 ---------- */
function detectRisks(text, result) {
  const risks = [];

  if (!result.retentionContext && result.durations.length === 0) {
    risks.push(reason("warning", "보유기간을 명시한 문구를 찾지 못했어요. 개인정보가 얼마나 보관되는지 알 수 없어요."));
  } else if (result.retentionContext && /(영구|무기한|반영구)/.test(result.retentionContext)) {
    risks.push(reason("danger", "개인정보를 영구적으로 보관한다는 문구가 있어요. 보관 필요성이 있는지 확인해보세요."));
  }

  if (/(목적\s*외|필요(하다고|시)\s*판단되는\s*경우)/.test(text)) {
    risks.push(reason("warning", "'목적 외 이용'이 가능하다고 해석될 수 있는 문구가 있어요. 구체적인 범위를 확인해보세요."));
  }

  const sensitiveHits = ["주민등록번호", "여권번호", "운전면허", "건강정보", "신용정보", "위치정보"].filter((k) =>
    text.includes(k)
  );
  if (sensitiveHits.length) {
    risks.push(
      reason("warning", `민감할 수 있는 개인정보(${sensitiveHits.join(", ")})를 수집한다고 명시되어 있어요. 수집 근거를 확인해보세요.`)
    );
  }

  if (result.thirdPartyContext && /(관계\s*회사|계열사|제휴사\s*전체)/.test(result.thirdPartyContext)) {
    risks.push(reason("warning", "제3자 제공 범위가 폭넓게 명시되어 있어요. 어떤 회사에 어떤 정보가 제공되는지 확인해보세요."));
  }

  if (result.overseasContext) {
    risks.push(reason("warning", "개인정보를 해외로 이전할 수 있다고 명시되어 있어요. 이전 국가와 보호 수준을 확인해보세요."));
  }

  if (result.rights.length === 0) {
    risks.push(reason("danger", "열람·정정·삭제 등 이용자 권리에 대한 안내를 찾지 못했어요."));
  }

  if (!result.contactContext) {
    risks.push(reason("warning", "개인정보 보호책임자 또는 문의처 정보를 찾지 못했어요."));
  }

  return risks;
}

function renderPills(items, hit = true) {
  if (!items.length) return `<p class="empty-note">해당 내용을 찾지 못했습니다.</p>`;
  return `<div class="tag-list">${items.map((i) => `<span class="pill ${hit ? "hit" : ""}">${i}</span>`).join("")}</div>`;
}

function renderValue(text, fallback) {
  return text
    ? `<p class="value">${text}</p>`
    : `<p class="empty-note">${fallback}</p>`;
}

function renderRisks(text, result) {
  const risks = detectRisks(text, result);
  const dangerCount = risks.filter((r) => r.level === "danger").length;
  const warningCount = risks.filter((r) => r.level === "warning").length;

  let cls = "safe";
  let icon = "✅";
  let label = "위험 신호를 찾지 못했어요";
  let scoreText = "발견된 주의 항목이 없어요.";

  if (dangerCount > 0) {
    cls = "danger";
    icon = "🚨";
    label = "위험 요소가 발견됐어요";
    scoreText = `주의 항목 ${dangerCount + warningCount}건 발견 (심각 ${dangerCount}건)`;
  } else if (warningCount > 0) {
    cls = "warning";
    icon = "⚠️";
    label = "주의가 필요한 항목이 있어요";
    scoreText = `주의 항목 ${warningCount}건 발견`;
  }

  document.getElementById("policy-risk-banner").className = `verdict-banner ${cls}`;
  document.getElementById("policy-risk-icon").textContent = icon;
  document.getElementById("policy-risk-label").textContent = label;
  document.getElementById("policy-risk-score").textContent = scoreText;

  document.getElementById("policy-risk-list").innerHTML = risks.length
    ? risks
        .map(
          (r) => `
        <div class="reason-item flag-${r.level}">
          <span class="r-icon">${r.level === "danger" ? "🚨" : "⚠️"}</span>
          <span>${r.text}</span>
        </div>
      `
        )
        .join("")
    : "";
}

function renderResult(text, result) {
  const wrap = document.getElementById("policy-result-wrap");
  wrap.classList.add("visible");

  document.getElementById("policy-summary-text").textContent = buildShortSummary(result);
  renderRisks(text, result);

  document.getElementById("summary-collect").innerHTML = renderPills(result.collected);
  document.getElementById("summary-retention").innerHTML =
    renderValue(result.retentionContext, "보유기간 관련 문구를 찾지 못했습니다.") +
    (result.durations.length ? renderPills(result.durations) : "");
  document.getElementById("summary-thirdparty").innerHTML = renderValue(
    result.thirdPartyContext,
    "제3자 제공/위탁 관련 언급을 찾지 못했습니다. 원문에 명시되어 있는지 다시 확인해보세요."
  );
  document.getElementById("summary-purpose").innerHTML = renderValue(
    result.purposeContext,
    "이용 목적 관련 문구를 찾지 못했습니다."
  );
  document.getElementById("summary-rights").innerHTML = renderPills(result.rights);
  document.getElementById("summary-contact").innerHTML = renderValue(
    result.contactContext,
    "담당자/문의처 관련 문구를 찾지 못했습니다."
  );

  const extraBits = [];
  extraBits.push(
    `<span class="pill ${result.cookieUsed ? "hit" : ""}">${result.cookieUsed ? "쿠키 사용함" : "쿠키 언급 없음"}</span>`
  );
  extraBits.push(
    `<span class="pill ${result.overseasContext ? "hit" : ""}">${result.overseasContext ? "해외 이전 있음" : "해외 이전 언급 없음"}</span>`
  );
  document.getElementById("summary-extra").innerHTML = `<div class="tag-list">${extraBits.join("")}</div>`;

  const checklistHtml = result.checklist
    .map(
      (c) => `
      <div class="reason-item ${c.found ? "flag-safe" : "flag-warning"}">
        <span class="r-icon">${c.found ? "✅" : "⚠️"}</span>
        <span>${c.label} ${c.found ? "— 문서에서 확인됐어요." : "— 문서에서 찾지 못했어요. 원문을 다시 확인해보세요."}</span>
      </div>
    `
    )
    .join("");
  document.getElementById("checklist").innerHTML = checklistHtml;

  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

function init() {
  const textarea = document.getElementById("policy-input");
  const analyzeBtn = document.getElementById("policy-analyze-btn");
  const sampleBtn = document.getElementById("policy-sample-btn");

  sampleBtn.addEventListener("click", () => {
    textarea.value = SAMPLE_POLICY;
  });

  analyzeBtn.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (!text) {
      textarea.focus();
      return;
    }
    const result = analyzePolicy(text);
    renderResult(text, result);
  });
}

init();
