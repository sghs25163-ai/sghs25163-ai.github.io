/*
 * 홈 대시보드: 오늘의 개인정보 보호 팁 / 보안 뉴스 / 유출 사건을 보여준다.
 * 지금은 예시(샘플) 데이터를 사용한다. 실제 서비스에서는 아래 DATA들을
 * 뉴스 API·RSS·공공데이터(개인정보보호위원회, KISA 등) 연동 결과로 교체하면 된다.
 */

const TIPS = [
  "회원가입 시 '선택 항목'으로 표시된 개인정보는 입력하지 않아도 서비스 이용에 지장이 없어요.",
  "오랫동안 쓰지 않는 앱과 사이트의 회원 탈퇴를 주기적으로 해두면 유출 위험을 줄일 수 있어요.",
  "비밀번호는 사이트마다 다르게 설정하고, 가능하면 2단계 인증(OTP)을 켜두세요.",
  "출처가 불분명한 링크의 '개인정보 동의' 요청은 클릭 전에 반드시 발신 주소를 확인하세요.",
  "공공 와이파이에서는 로그인이 필요한 금융·쇼핑 서비스 이용을 피하는 것이 안전해요.",
  "앱을 설치할 때 요구하는 권한(위치, 연락처, 카메라 등)이 서비스 목적과 맞는지 확인하세요.",
  "개인정보 처리방침에서 '보유기간'과 '제3자 제공' 항목은 꼭 한 번씩 확인하는 습관을 들이세요.",
  "문자·카카오톡으로 온 인증번호는 절대 타인에게 알려주지 마세요. 금융기관은 먼저 묻지 않아요.",
  "회원 탈퇴 시 개인정보가 '즉시 파기'되는지, 일정 기간 보관되는지 확인해보세요.",
  "가족·지인을 사칭한 금전 요구 메시지는 반드시 전화로 본인 확인 후 대응하세요.",
];

/* ---------- MOCK DATA (실제 연동 시 이 부분을 교체) ---------- */
const NEWS = [
  {
    icon: "🛡️",
    title: "개인정보보호위원회, AI 서비스 개인정보 처리 가이드라인 발표",
    source: "보안 데일리",
    time: "1시간 전",
  },
  {
    icon: "🔐",
    title: "스미싱 문자 신고 건수 전월 대비 32% 증가... \"택배·환급 사칭 주의\"",
    source: "사이버안전 뉴스",
    time: "3시간 전",
  },
  {
    icon: "📱",
    title: "메신저 피싱, 이제는 딥페이크 음성까지... 지인 사칭 수법 진화",
    source: "IT 시큐리티",
    time: "5시간 전",
  },
  {
    icon: "🏦",
    title: "금융권, 이상거래 탐지에 AI 도입 확대... 피해 예방률 높아져",
    source: "핀테크 투데이",
    time: "어제",
  },
  {
    icon: "🧑‍💻",
    title: "\"비밀번호 재사용이 가장 큰 위험\"... 전문가들이 꼽은 계정 보호 수칙",
    source: "보안 데일리",
    time: "어제",
  },
];

const BREACHES = [
  {
    icon: "⚠️",
    title: "OO쇼핑몰, 회원 이메일·연락처 일부 유출 정황 확인",
    meta: "약 1.2만 건 추정",
    severity: "mid",
    time: "3일 전",
  },
  {
    icon: "🚨",
    title: "OO커뮤니티 플랫폼, 해킹으로 로그인 정보 유출... 비밀번호 변경 권고",
    meta: "약 8만 건 추정",
    severity: "high",
    time: "5일 전",
  },
  {
    icon: "⚠️",
    title: "OO배달 앱, 제휴사 서버 오류로 주문 내역 일부 노출",
    meta: "약 3천 건 추정",
    severity: "mid",
    time: "1주 전",
  },
  {
    icon: "🚨",
    title: "OO교육 플랫폼, 학생·보호자 개인정보 유출로 과징금 부과",
    meta: "약 5.5만 건 추정",
    severity: "high",
    time: "2주 전",
  },
];
/* ---------- MOCK DATA 끝 ---------- */

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

function renderTip() {
  const today = new Date();
  const tip = TIPS[dayOfYear(today) % TIPS.length];
  document.getElementById("tip-text").textContent = tip;
}

function renderNews() {
  const list = document.getElementById("news-list");
  list.innerHTML = NEWS.map(
    (n) => `
    <div class="news-item">
      <div class="item-icon">${n.icon}</div>
      <div class="item-body">
        <h3>${n.title}</h3>
        <div class="item-meta">
          <span class="src">${n.source}</span>
          <span>${n.time}</span>
        </div>
      </div>
    </div>
  `
  ).join("");
}

function renderBreaches() {
  const list = document.getElementById("breach-list");
  list.innerHTML = BREACHES.map(
    (b) => `
    <div class="breach-item">
      <div class="item-icon">${b.icon}</div>
      <div class="item-body">
        <h3>${b.title}</h3>
        <div class="item-meta">
          <span class="severity ${b.severity}">${b.severity === "high" ? "심각" : "주의"}</span>
          <span>${b.meta}</span>
          <span>${b.time}</span>
        </div>
      </div>
    </div>
  `
  ).join("");
}

renderTip();
renderNews();
renderBreaches();
