/* ─────────────────────────────────────────────
   THEME  (runs immediately — no DOM needed)
───────────────────────────────────────────── */
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const backendBaseUrl = "https://model-tr.onrender.com";
let selectedModel    = "t1";
let attachedFiles    = [];   // { file, dataURL, base64, mimeType, type }
let autoScroll       = true;

/* ─────────────────────────────────────────────
   SUPABASE
───────────────────────────────────────────── */
const SUPABASE_URL      = "https://ctquajydjitfjhqvezfz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0cXVhanlkaml0ZmpocXZlemZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjA1MzQsImV4cCI6MjA4MzE5NjUzNH0.3cenuqB4XffJdRQisJQhq7PS9_ybXDN7ExbsKfXx9gU";

const supabaseClient =
  typeof supabase !== "undefined"
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/* ─────────────────────────────────────────────
   ACHIEVEMENTS / BADGES SYSTEM
───────────────────────────────────────────── */
const BADGE_DEFINITIONS = [
  // Question milestones
  { id: "first_question", name: "First Step", desc: "Ask your first question", icon: "🎯", category: "questions", requirement: { type: "questions", value: 1 } },
  { id: "questions_10", name: "Curious Mind", desc: "Ask 10 questions", icon: "🧠", category: "questions", requirement: { type: "questions", value: 10 } },
  { id: "questions_50", name: "Knowledge Seeker", desc: "Ask 50 questions", icon: "📚", category: "questions", requirement: { type: "questions", value: 50 } },
  { id: "questions_100", name: "Question Master", desc: "Ask 100 questions", icon: "🏅", category: "questions", requirement: { type: "questions", value: 100 } },
  { id: "questions_500", name: "Scholar", desc: "Ask 500 questions", icon: "🎓", category: "questions", requirement: { type: "questions", value: 500 } },
  
  // Streak badges
  { id: "streak_3", name: "Getting Started", desc: "3-day study streak", icon: "🔥", category: "streak", requirement: { type: "streak", value: 3 } },
  { id: "streak_7", name: "Week Warrior", desc: "7-day study streak", icon: "💪", category: "streak", requirement: { type: "streak", value: 7 } },
  { id: "streak_14", name: "Dedicated", desc: "14-day study streak", icon: "⭐", category: "streak", requirement: { type: "streak", value: 14 } },
  { id: "streak_30", name: "Unstoppable", desc: "30-day study streak", icon: "🏆", category: "streak", requirement: { type: "streak", value: 30 } },
  { id: "streak_100", name: "Legend", desc: "100-day study streak", icon: "👑", category: "streak", requirement: { type: "streak", value: 100 } },
  
  // Time-based badges
  { id: "night_owl", name: "Night Owl", desc: "Study after 11 PM", icon: "🦉", category: "time", requirement: { type: "time_of_day", value: "night" } },
  { id: "early_bird", name: "Early Bird", desc: "Study before 6 AM", icon: "🐦", category: "time", requirement: { type: "time_of_day", value: "morning" } },
  { id: "weekend_warrior", name: "Weekend Warrior", desc: "Study on a weekend", icon: "📅", category: "time", requirement: { type: "day_of_week", value: "weekend" } },
  
  // Study time badges (in minutes)
  { id: "time_1h", name: "Hour One", desc: "Study for 1 hour total", icon: "⏰", category: "study_time", requirement: { type: "study_time", value: 60 } },
  { id: "time_5h", name: "Five Strong", desc: "Study for 5 hours total", icon: "⏳", category: "study_time", requirement: { type: "study_time", value: 300 } },
  { id: "time_10h", name: "Dedicated Learner", desc: "Study for 10 hours total", icon: "📖", category: "study_time", requirement: { type: "study_time", value: 600 } },
  { id: "time_24h", name: "Full Day", desc: "Study for 24 hours total", icon: "🌟", category: "study_time", requirement: { type: "study_time", value: 1440 } },
  { id: "time_100h", name: "Century Club", desc: "Study for 100 hours total", icon: "💎", category: "study_time", requirement: { type: "study_time", value: 6000 } },
];

// Track newly unlocked badges for toast notifications
let newlyUnlockedBadges = [];

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatGeminiResponse(text) {
  if (!text) return "";

  // Protect -> and --> from HTML escaping, then restore as → with single space each side
  text = text
    .replace(/-->/g, "\x00ARROW2\x00")
    .replace(/->/g,  "\x00ARROW1\x00");

  text = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  text = text
    .replace(/\s*\x00ARROW2\x00\s*/g, " \u2192 ")
    .replace(/\s*\x00ARROW1\x00\s*/g, " \u2192 ");

  // Superscripts: braced ^{n+1} first, then bare ^2
  text = text.replace(/\^\{([^}]+)\}/g, (_, g) => "<sup>" + g + "</sup>");
  text = text.replace(/\^([A-Za-z0-9+\-]+)/g, (_, g) => "<sup>" + g + "</sup>");

  // Subscripts: braced _{...} first, then bare _digits after letter or )
  text = text.replace(/_\{([^}]+)\}/g, (_, g) => "<sub>" + g + "</sub>");
  text = text.replace(/([A-Za-z\)])_(\d+)/g, (_, pre, g) => pre + "<sub>" + g + "</sub>");

  // Highlights: *text* → <mark>
  text = text.replace(/\*(.*?)\*/g, '<mark class="ai-highlight">$1</mark>');

  // Newlines
  text = text.replace(/\n/g, "<br>");

  return text;
}

/* ── Copy toast helper ── */
function showCopyToast(msg = "Copied to clipboard") {
  let toast = document.getElementById("copyToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "copyToast";
    toast.className = "copy-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 1800);
}
async function recordRating(rating, question, answerText) {
  if (!supabaseClient) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    await supabaseClient.from("message_ratings").insert({
      user_id:        session?.user?.id ?? null,
      rating,                                      // 1 or -1
      question:       question.slice(0, 500),
      answer_snippet: answerText.slice(0, 500),
      created_at:     new Date().toISOString(),
    });
  } catch (e) { /* silent */ }
}

/* ── Append action bar below a bot bubble ── */
function addMessageActions(botRow, content, question, onRegenerate, initialRating = 0) {
  const bar = document.createElement("div");
  bar.className = "msg-actions";

  function makeBtn(svgPath, title, viewBox = "0 0 24 24") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "msg-action-btn";
    btn.title = title;
    btn.innerHTML = `<svg width="18" height="18" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
    return btn;
  }

  /* Copy */
  const copyBtn = makeBtn(
    `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
    "Copy"
  );
  copyBtn.addEventListener("click", () => {
    // Extract readable plain text: convert sup/sub back to notation, strip marks
    function extractPlainText(el) {
      let result = "";
      el.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          result += node.textContent;
        } else if (node.nodeName === "SUP") {
          result += "^" + node.textContent;
        } else if (node.nodeName === "SUB") {
          result += "_" + node.textContent;
        } else if (node.nodeName === "BR") {
          result += "\n";
        } else {
          result += extractPlainText(node);
        }
      });
      return result;
    }
    const text = extractPlainText(content);
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.classList.add("copied");

      // Show tiny label under the button
      let label = copyBtn.querySelector(".copy-label");
      if (!label) {
        label = document.createElement("span");
        label.className = "copy-label";
        label.textContent = "Copied";
        copyBtn.style.position = "relative";
        copyBtn.appendChild(label);
      }
      label.classList.add("visible");
      clearTimeout(copyBtn._ct);
      copyBtn._ct = setTimeout(() => {
        copyBtn.classList.remove("copied");
        label.classList.remove("visible");
      }, 1800);
    });
  });

  /* Thumbs up */
  const thumbUpBtn = makeBtn(
    `<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>`,
    "Helpful"
  );

  /* Thumbs down */
  const thumbDownBtn = makeBtn(
    `<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>`,
    "Not helpful"
  );

  let rated = false;

  function applyRatingVisual(value) {
    rated = true;
    if (value === 1) {
      thumbUpBtn.classList.add("active-thumb-up");
      const svg = thumbUpBtn.querySelector("svg");
      if (svg) { svg.setAttribute("fill", "currentColor"); svg.setAttribute("stroke", "none"); }
      thumbDownBtn.style.opacity = "0.3";
      thumbDownBtn.style.pointerEvents = "none";
    } else if (value === -1) {
      thumbDownBtn.classList.add("active-thumb-down");
      const svg = thumbDownBtn.querySelector("svg");
      if (svg) { svg.setAttribute("fill", "currentColor"); svg.setAttribute("stroke", "none"); }
      thumbUpBtn.style.opacity = "0.3";
      thumbUpBtn.style.pointerEvents = "none";
    }
  }

  // Restore saved rating state immediately (when loading from history)
  if (initialRating !== 0) applyRatingVisual(initialRating);

  function handleRating(btn, otherBtn, value) {
    if (rated) return;
    applyRatingVisual(value);
    const answerText = content.innerText || content.textContent;
    recordRating(value, question, answerText);
    // Persist rating on the last bot message in the buffer
    if (window._activeHistorySessionId) {
      const buf = _sessionMsgBuffer[window._activeHistorySessionId];
      if (buf) {
        // Find the last bot message and set its rating
        for (let i = buf.length - 1; i >= 0; i--) {
          if (buf[i].role === "bot") {
            buf[i].rating = value;
            break;
          }
        }
        // Flush updated buffer to Supabase
        _flushBufferToSupabase(window._activeHistorySessionId);
      }
    }
  }
  thumbUpBtn.addEventListener("click",   () => handleRating(thumbUpBtn,   thumbDownBtn,  1));
  thumbDownBtn.addEventListener("click", () => handleRating(thumbDownBtn, thumbUpBtn,   -1));

  /* Regenerate */
  const regenBtn = makeBtn(
    `<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>`,
    "Regenerate"
  );
  regenBtn.addEventListener("click", () => {
    bar.classList.add("visible"); // keep visible during regen
    onRegenerate();
  });

  /* Share */
  const shareBtn = makeBtn(
    `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>`,
    "Share"
  );
  shareBtn.addEventListener("click", () => {
    const answerText = content.innerText || content.textContent;
    openShareModal(question, answerText);
  });

  bar.appendChild(copyBtn);
  bar.appendChild(thumbUpBtn);
  bar.appendChild(thumbDownBtn);
  bar.appendChild(regenBtn);
  bar.appendChild(shareBtn);
  botRow.appendChild(bar);
}

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ─────────────────────────────────────────────
   AUTH HELPERS  (used by login.html / signup.html)
───────────────────────────────────────────── */
function showAuthMessage(text, type = "error") {
  const box = document.getElementById("authMessage");
  if (!box) return;
  box.textContent = text;
  box.className   = `auth-message ${type}`;
  box.style.display = "block";
}

async function login(event) {
  event.preventDefault();
  if (!supabaseClient) return;

  const raw      = (document.getElementById("emailOrUsername") || document.getElementById("email"))?.value.trim();
  const password = document.getElementById("password")?.value;
  if (!raw || !password) { showAuthMessage("Please enter your email/username and password."); return; }

  const btn = document.getElementById("loginBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Logging in…"; }

  let email = raw;

  if (!raw.includes("@")) {
    // Username lookup — works because user_profiles has public SELECT policy
    const { data: rows } = await supabaseClient
      .from("user_profiles")
      .select("email")
      .eq("username", raw.toLowerCase())
      .limit(1);

    if (!rows || rows.length === 0) {
      showAuthMessage("No account found with that username.");
      if (btn) { btn.disabled = false; btn.textContent = "Continue"; }
      return;
    }
    email = rows[0].email;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (btn) { btn.disabled = false; btn.textContent = "Continue"; }
  if (error) {
    if (error.message.includes("Email not confirmed")) {
      showAuthMessage("Please confirm your email first. Check your inbox.");
    } else {
      showAuthMessage("Incorrect credentials. Try again.");
    }
    return;
  }
  showAuthMessage("Login successful.", "success");
  setTimeout(() => location.href = "dashboard.html", 800);
}

async function forgotPassword(event) {
  event.preventDefault();
  if (!supabaseClient) return;

  const raw = document.getElementById("forgotEmailOrUsername")?.value.trim();
  if (!raw) {
    showForgotMessage("Please enter your email or username.");
    return;
  }

  const btn = document.getElementById("sendResetBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }

  let email = raw;

  // If username provided, look up email
  if (!raw.includes("@")) {
    const { data: rows } = await supabaseClient
      .from("user_profiles")
      .select("email")
      .eq("username", raw.toLowerCase())
      .limit(1);

    if (!rows || rows.length === 0) {
      showForgotMessage("No account found with that username.");
      if (btn) { btn.disabled = false; btn.textContent = "Send Reset Link"; }
      return;
    }
    email = rows[0].email;
  }

  // Send password reset email
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password.html"
  });

  if (btn) { btn.disabled = false; btn.textContent = "Send Reset Link"; }

  if (error) {
    showForgotMessage("Failed to send reset email. Please try again.");
    return;
  }

  showForgotMessage("Password reset link sent! Check your email.", "success");
  setTimeout(() => {
    closeForgotPasswordModal();
    document.getElementById("forgotEmailOrUsername").value = "";
  }, 2000);
}

function showForgotMessage(msg, type = "error") {
  const el = document.getElementById("forgotMessage");
  if (!el) return;
  el.textContent = msg;
  el.className = "auth-message " + type;
}

function openForgotPasswordModal() {
  const modal = document.getElementById("forgotPasswordModal");
  if (modal) {
    modal.style.display = "flex";
    document.getElementById("forgotMessage").className = "auth-message";
  }
}

function closeForgotPasswordModal() {
  const modal = document.getElementById("forgotPasswordModal");
  if (modal) {
    modal.style.display = "none";
    document.getElementById("forgotMessage").className = "auth-message";
  }
}

async function signup(event) {
  event.preventDefault();
  if (!supabaseClient) return;

  const email       = document.getElementById("email")?.value.trim();
  const password    = document.getElementById("password")?.value;
  const fullName    = document.getElementById("fullName")?.value.trim()    || "";
  const usernameRaw = document.getElementById("username")?.value.trim()    || "";
  const classVal    = document.getElementById("signupClass")?.value        || "10";
  const board       = document.getElementById("signupBoard")?.value        || "ICSE";
  const username    = usernameRaw.toLowerCase();

  if (!email || !password || !fullName) {
    showAuthMessage("Please fill in all required fields.");
    return;
  }

  // Username validation
  if (!username || username.length < 3) {
    showAuthMessage("Username must be at least 3 characters.");
    return;
  }
  if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
    showAuthMessage("Username can only contain letters, numbers, _ and .");
    return;
  }

  // Check username uniqueness BEFORE creating auth user
  const { data: existingUser } = await supabaseClient
    .from("user_profiles")
    .select("id")
    .eq("username", username)
    .limit(1);
  if (existingUser && existingUser.length > 0) {
    showAuthMessage("That username is already taken. Please choose another.");
    return;
  }

  // Check email uniqueness BEFORE creating auth user
  const { data: existingEmail } = await supabaseClient
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (existingEmail && existingEmail.length > 0) {
    showAuthMessage("This email is already registered. Try logging in instead.");
    return;
  }

  const btn = document.getElementById("signupBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }

  // Create auth user — pass profile data as metadata so the DB trigger can use it
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name:   fullName,
        username,
        class_level: classVal,
        board,
      }
    }
  });
  if (error) {
    const msg = error.message || "";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already been registered") || msg.toLowerCase().includes("user already exists")) {
      showAuthMessage("This email is already registered. Try logging in instead.");
    } else {
      showAuthMessage("Signup failed: " + msg);
    }
    if (btn) { btn.disabled = false; btn.textContent = "Create account"; }
    return;
  }

  // Profile data to save
  const profileData = {
    full_name:          fullName,
    username,
    email,
    class_level:        classVal,
    board,
    streak:             0,
    best_streak:        0,
    last_active_date:   null,
    total_time_minutes: 0,
    questions_count:    0,
    bio:                "",
  };

  // Always save to localStorage as fallback
  localStorage.setItem("pendingProfile", JSON.stringify(profileData));

  // Attempt immediate insert using the returned user.id.
  // Works when email confirmation is disabled (session returned).
  // When email confirm is ON, the DB trigger handles it automatically.
  if (data?.user?.id) {
    try {
      const { error: insertErr } = await supabaseClient
        .from("user_profiles")
        .upsert({ id: data.user.id, ...profileData });
      if (!insertErr) localStorage.removeItem("pendingProfile");
    } catch (e) { /* DB trigger will handle it */ }
  }

  showAuthMessage("Account created! Check your email to confirm, then login.", "success");
  if (btn) { btn.disabled = false; btn.textContent = "Create account"; }
}

async function logout() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) { alert("Logout failed. Try again."); return; }
  localStorage.removeItem("supabase.auth.token");
  window.location.href = "login.html";
}

/* ─────────────────────────────────────────────
   EVERYTHING THAT NEEDS THE DOM
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {

  /* ── DOM refs ── */
  const classLevelSelect = document.getElementById("classLevel");
  const boardSelect      = document.getElementById("board");
  const subjectSelect    = document.getElementById("subject");
  const chapterInput     = document.getElementById("chapter");
  const questionInput    = document.getElementById("questionInput");
  const sendBtn          = document.getElementById("sendBtn");
  const chatWindow       = document.getElementById("chatWindow");
  const questionForm     = document.getElementById("questionForm");
  const uploadBtn        = document.getElementById("uploadBtn");
  const fileInput        = document.getElementById("fileInput");
  const chipsRow         = document.getElementById("uploadChipsRow");
  const voiceBtn         = document.getElementById("voiceBtn");
  const menuToggle       = document.getElementById("menuToggle");
  const menuDropdown     = document.getElementById("menuDropdown");
  const themeToggle      = document.getElementById("themeToggle");

  /* ════════════════════════════════
     SESSION GUARD + AUTH STATE LISTENER
  ════════════════════════════════ */
  if (supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const page = window.location.pathname.split("/").pop() || "index.html";

    if (["login.html", "signup.html"].includes(page) && session) {
      window.location.replace("dashboard.html"); return;
    }
    if (page === "dashboard.html" && !session) {
      window.location.replace("login.html"); return;
    }

    // ── Hide page loader now that auth check is done ──
    window.__hidePageLoader?.();

    // ── Pending profile: write it now that user has a live session ──
    if (session) {
      const pending = localStorage.getItem("pendingProfile");
      if (pending) {
        try {
          const profileData = JSON.parse(pending);
          await supabaseClient.from("user_profiles").upsert({
            id: session.user.id,
            ...profileData,
          });
          localStorage.removeItem("pendingProfile");
        } catch (e) { /* retry next time */ }
      }
    }

    // ── Auto-logout: handle account deletion and token revocation on ALL pages ──
    supabaseClient.auth.onAuthStateChange((event, changedSession) => {
      const publicPages = ["login.html", "signup.html", "index.html", "founder.html", "help.html"];
      const currentPage = window.location.pathname.split("/").pop() || "index.html";

      if (event === "USER_DELETED") {
        // Account was deleted — sign out locally and redirect
        supabaseClient.auth.signOut().catch(() => {});
        localStorage.removeItem("supabase.auth.token");
        window.location.replace("login.html");
        return;
      }

      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !changedSession)) {
        // Signed out or token invalid — redirect from protected pages
        if (!publicPages.includes(currentPage)) {
          window.location.replace("login.html");
        }
        return;
      }

      // When session refreshes successfully, update nav links
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        updateNavAuthLinks();
      }
    });


  }

  /* ════════════════════════════════
     THEME + NAVBAR
  ════════════════════════════════ */
  document.body.setAttribute("data-theme", localStorage.getItem("theme") || "dark");

  menuToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown?.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (menuDropdown && !menuDropdown.contains(e.target) && !menuToggle?.contains(e.target)) {
      menuDropdown.classList.remove("open");
    }
  });

  themeToggle?.addEventListener("click", () => {
    const next = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = next;
    localStorage.setItem("theme", next);
  });

  /* ════════════════════════════════
     STORYTELLING: SCROLL-REVEAL ANIMATIONS
  ════════════════════════════════ */
  const scrollRevealEls = document.querySelectorAll(".animate-on-scroll");
  if (scrollRevealEls.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    scrollRevealEls.forEach((el) => observer.observe(el));
  }

  /* ════════════════════════════════
     PREMIUM: Navbar scroll shadow
  ════════════════════════════════ */
  const nav = document.querySelector(".navbar");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("navbar-scrolled", window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ════════════════════════════════
     MODEL SELECTOR — Gemini-style flat, fixed-position dropdown
  ════════════════════════════════ */
  const mBtn  = document.getElementById("modelBtn");
  const mDrop = document.getElementById("modelDropdown");

  if (mBtn && mDrop) {
    const pillLabel = document.getElementById("modelPillLabel");
    const chipIcon  = mBtn.querySelector(".model-chip-icon");
    const checkT1   = document.getElementById("checkT1");
    const checkT2   = document.getElementById("checkT2");

    const modelMeta = {
      t1: { label: "T1 · Flash", icon: "⚡" },
      t2: { label: "T2 · Pro",   icon: "🧠" },
    };

    function setActiveModel(model) {
      selectedModel = model;
      if (pillLabel) pillLabel.textContent = modelMeta[model].label;
      if (chipIcon)  chipIcon.textContent  = modelMeta[model].icon;
      if (checkT1)   checkT1.textContent   = model === "t1" ? "✓" : "";
      if (checkT2)   checkT2.textContent   = model === "t2" ? "✓" : "";
      mDrop.querySelectorAll(".mdp-option").forEach(el => {
        el.classList.toggle("active", el.dataset.model === model);
      });
    }

    function positionAndOpen() {
      const r = mBtn.getBoundingClientRect();
      const dropW = mDrop.offsetWidth || 230;
      // Place above the button
      let left = r.right - dropW;
      if (left < 8) left = 8;
      mDrop.style.left   = left + "px";
      mDrop.style.top    = "auto";
      mDrop.style.bottom = (window.innerHeight - r.top + 8) + "px";
      mDrop.classList.add("open");
      mBtn.classList.add("open");
    }

    function closeDropdown() {
      mDrop.classList.remove("open");
      mBtn.classList.remove("open");
    }

    mBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      mDrop.classList.contains("open") ? closeDropdown() : positionAndOpen();
    });

    mDrop.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-model]");
      if (!opt) return;
      setActiveModel(opt.dataset.model);
      closeDropdown();
    });

    document.addEventListener("click", (e) => {
      if (!mBtn.contains(e.target) && !mDrop.contains(e.target)) closeDropdown();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdown();
    });

    setActiveModel("t1");
  }


  /* ════════════════════════════════
     AUTO-SCROLL DETECTION
  ════════════════════════════════ */
  /* ── Always auto-scroll to bottom during streaming ── */

  /* ════════════════════════════════
     AUTO-GROW TEXTAREA
  ════════════════════════════════ */
  function growTextarea() {
    if (!questionInput) return;
    questionInput.style.height = "auto";
    questionInput.style.height = Math.min(questionInput.scrollHeight, 160) + "px";
  }

  questionInput?.addEventListener("input", growTextarea);

  /* ════════════════════════════════
     UPLOAD DROPDOWN — show menu with options
  ════════════════════════════════ */
  const uploadDropdown = document.getElementById("uploadDropdown");
  const photoInput = document.getElementById("photoInput");
  const cameraInput = document.getElementById("cameraInput");

  // Show upload dropdown when upload button clicked
  uploadBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!uploadDropdown) return;
    
    const isOpen = uploadDropdown.classList.contains("open");
    uploadDropdown.classList.toggle("open", !isOpen);
    
    if (!isOpen) {
      const rect = uploadBtn.getBoundingClientRect();
      uploadDropdown.style.left = rect.left + "px";
      uploadDropdown.style.bottom = (window.innerHeight - rect.top + 8) + "px";
    }
  });

  // Close upload dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (uploadDropdown && !uploadDropdown.contains(e.target) && e.target !== uploadBtn) {
      uploadDropdown.classList.remove("open");
    }
  });

  // Handle upload option clicks
  document.querySelectorAll(".upload-option").forEach(option => {
    option.addEventListener("click", () => {
      const type = option.dataset.uploadType;
      uploadDropdown?.classList.remove("open");
      
      if (type === "file") {
        fileInput?.click();
      } else if (type === "photo") {
        photoInput?.click();
      } else if (type === "camera") {
        cameraInput?.click();
      }
    });
  });

  /* ════════════════════════════════
     FILE UPLOAD — chip UI (handles all inputs)
  ════════════════════════════════ */
  async function handleFileSelection(files) {
    for (const file of files) {
      if (attachedFiles.find(f => f.file.name === file.name)) continue;

      const mimeType = file.type || "application/octet-stream";
      const isImage  = mimeType.startsWith("image/");
      const isPDF    = mimeType === "application/pdf";
      const isText   = mimeType.startsWith("text/");
      const fileType = isImage ? "image" : isPDF ? "pdf" : isText ? "text" : "other";

      const entry = { file, dataURL: null, base64: null, mimeType, type: fileType };
      attachedFiles.push(entry);

      try {
        entry.base64 = await fileToBase64(file);
        if (isImage) entry.dataURL = "data:" + mimeType + ";base64," + entry.base64;
      } catch (err) {
        console.error("File read error:", err);
      }

      addChip(entry);
    }
  }

  fileInput?.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    await handleFileSelection(files);
    fileInput.value = "";
  });

  photoInput?.addEventListener("change", async () => {
    const files = Array.from(photoInput.files || []);
    await handleFileSelection(files);
    photoInput.value = "";
  });

  cameraInput?.addEventListener("change", async () => {
    const files = Array.from(cameraInput.files || []);
    await handleFileSelection(files);
    cameraInput.value = "";
  });

  function addChip(entry) {
    if (!chipsRow) return;
    chipsRow.classList.add("has-files");

    const chip = document.createElement("div");
    chip.className  = "upload-chip";
    chip.dataset.name = entry.file.name;

    if (entry.type === "image" && entry.dataURL) {
      const img = document.createElement("img");
      img.src = entry.dataURL;
      img.className = "chip-thumb";
      img.style.cursor = "zoom-in";
      img.addEventListener("click", (e) => { e.stopPropagation(); openLightbox(entry.dataURL, entry.file.name); });
      chip.appendChild(img);
    } else {
      const icon = document.createElement("div");
      icon.className   = "chip-file-icon";
      icon.textContent = entry.type === "pdf" ? "📄" : entry.type === "text" ? "📝" : "📎";
      chip.appendChild(icon);
    }

    const meta = document.createElement("div");
    meta.className = "chip-meta";
    const nameEl = document.createElement("span");
    nameEl.className   = "chip-name";
    nameEl.textContent = entry.file.name;
    const sizeEl = document.createElement("span");
    sizeEl.className   = "chip-size";
    sizeEl.textContent = fmtBytes(entry.file.size);
    meta.appendChild(nameEl);
    meta.appendChild(sizeEl);
    chip.appendChild(meta);

    const rm = document.createElement("button");
    rm.type      = "button";
    rm.className = "chip-remove";
    rm.innerHTML = "✕";
    rm.addEventListener("click", () => {
      attachedFiles = attachedFiles.filter(f => f.file.name !== entry.file.name);
      chip.remove();
      if (attachedFiles.length === 0) chipsRow.classList.remove("has-files");
    });
    chip.appendChild(rm);
    chipsRow.appendChild(chip);
  }

  /* ════════════════════════════════
     PASTE IMAGE (Ctrl+V / Cmd+V)
  ════════════════════════════════ */
  document.addEventListener("paste", (e) => {
    if (!chipsRow) return;
    const items      = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(i => i.type.startsWith("image/"));
    if (!imageItems.length) return;

    e.preventDefault();

    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (!file) return;

      const ext      = file.type.split("/")[1] || "png";
      const name     = "pasted-image-" + Date.now() + "." + ext;
      const named    = new File([file], name, { type: file.type });
      const mimeType = named.type;
      const entry    = { file: named, dataURL: null, base64: null, mimeType, type: "image" };
      attachedFiles.push(entry);

      const reader = new FileReader();
      reader.onload = (ev) => {
        entry.base64  = ev.target.result.split(",")[1];
        entry.dataURL = ev.target.result;
        addChip(entry);

        const bar = document.querySelector(".free-input-bar");
        if (bar) {
          bar.style.transition = "box-shadow 0.2s";
          bar.style.boxShadow  = "0 0 0 2px rgba(16,185,129,0.5)";
          setTimeout(() => { bar.style.boxShadow = ""; }, 500);
        }
      };
      reader.readAsDataURL(named);
    });
  });

  /* ════════════════════════════════
     IMAGE GENERATION DETECTION
  ════════════════════════════════ */
  // Detect image generation requests
  function isImageRequest(text) {
    const t = text.trim();
    const startsWithVisual = /^(draw|sketch|illustrate|visualize|visualise|diagram of|diagram for)/i.test(t);
    const containsImageWord = /(image|diagram|picture|illustration|drawing|sketch)/i.test(t);
    const containsVisualVerb = /^(draw|sketch|illustrate|generate|create|make|paint|visualize|visualise|design|show)/i.test(t);
    return startsWithVisual || (containsVisualVerb && containsImageWord);
  }

  /* ════════════════════════════════
     LIGHTBOX — full screen image viewer
  ════════════════════════════════ */
  function openLightbox(src, caption) {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "cursor:zoom-out;animation:lbFadeIn 0.18s ease;";

    // Top toolbar
    const topBar = document.createElement("div");
    topBar.style.cssText =
      "position:absolute;top:0;left:0;right:0;padding:12px 16px;" +
      "display:flex;align-items:center;justify-content:space-between;" +
      "background:linear-gradient(rgba(0,0,0,0.6),transparent);pointer-events:none;";

    const capEl = document.createElement("span");
    capEl.style.cssText = "color:rgba(255,255,255,0.7);font-size:0.82rem;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    capEl.textContent = caption || "";

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;pointer-events:auto;";

    function lbBtn(icon, title) {
      const b = document.createElement("button");
      b.type = "button"; b.title = title; b.innerHTML = icon;
      b.style.cssText =
        "background:rgba(255,255,255,0.12);backdrop-filter:blur(8px);border:none;" +
        "color:#fff;border-radius:8px;width:36px;height:36px;cursor:pointer;" +
        "font-size:16px;display:flex;align-items:center;justify-content:center;";
      b.addEventListener("mouseenter", () => b.style.background = "rgba(255,255,255,0.22)");
      b.addEventListener("mouseleave", () => b.style.background = "rgba(255,255,255,0.12)");
      return b;
    }

    const dlLbBtn = lbBtn("⬇", "Download");
    dlLbBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const a = document.createElement("a");
      a.href = src; a.download = "teengro-diagram.png"; a.click();
    });

    const closeLbBtn = lbBtn("✕", "Close");
    closeLbBtn.addEventListener("click", (e) => { e.stopPropagation(); overlay.remove(); });

    btnRow.appendChild(dlLbBtn);
    btnRow.appendChild(closeLbBtn);
    topBar.appendChild(capEl);
    topBar.appendChild(btnRow);

    // Image
    const img = document.createElement("img");
    img.src = src;
    img.style.cssText =
      "max-width:92vw;max-height:88vh;object-fit:contain;border-radius:10px;" +
      "box-shadow:0 8px 60px rgba(0,0,0,0.8);";
    img.addEventListener("click", (e) => e.stopPropagation());

    overlay.appendChild(topBar);
    overlay.appendChild(img);
    document.body.appendChild(overlay);

    // Close on backdrop click or Escape
    overlay.addEventListener("click", () => overlay.remove());
    const onKey = (e) => { if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
  }

  async function generateImage(prompt) {
    // ── User bubble ──
    const userRow    = document.createElement("div");
    userRow.className = "message-row user";
    const userBubble = document.createElement("div");
    userBubble.className = "message-bubble";
    const txt = document.createElement("div");
    txt.innerText = prompt;
    userBubble.appendChild(txt);
    userRow.appendChild(userBubble);
    document.getElementById("chatEmptyState")?.remove();
    chatWindow.appendChild(userRow);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // ── Clear input ──
    questionInput.value = "";
    questionInput.style.height = "auto";
    questionInput.disabled = true;
    sendBtn.disabled = true;

    // ── Bot loader bubble ──
    const botRow  = document.createElement("div");
    botRow.className = "message-row bot";
    const bubble  = document.createElement("div");
    bubble.className = "message-bubble";
    const content = document.createElement("div");

    // ── Image generation loader — canvas that fills in like pixels appearing ──
    const imgLoaderWrap = document.createElement("div");
    imgLoaderWrap.style.cssText =
      "display:flex;flex-direction:column;gap:10px;padding:4px 0;";

    // Canvas that progressively "paints" coloured blocks
    const canvas = document.createElement("canvas");
    const CW = 340, CH = 220, BLOCK = 10;
    canvas.width  = CW;
    canvas.height = CH;
    canvas.style.cssText =
      "width:100%;max-width:" + CW + "px;height:" + CH + "px;" +
      "border-radius:12px;border:1px solid rgba(255,255,255,0.08);display:block;";

    const ctx = canvas.getContext("2d");
    const cols = Math.ceil(CW / BLOCK);
    const rows = Math.ceil(CH / BLOCK);
    const totalBlocks = cols * rows;

    // Fill with dark base
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, CW, CH);

    // Shuffle block indices so they fill in random order
    const indices = Array.from({ length: totalBlocks }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Palette — muted blues/teals/purples like an AI rendering
    const palette = [
      "#1a1f2e","#1e2535","#22304a","#1a3a4a","#1e3550",
      "#243040","#182838","#1c2d3c","#202840","#1a2a3a",
      "#0f4c5c","#0d3348","#163447","#0e3d50","#103045",
    ];

    let painted = 0;
    const batchSize = Math.ceil(totalBlocks / 60); // fill over ~60 frames

    function paintFrame() {
      const end = Math.min(painted + batchSize, totalBlocks);
      for (let i = painted; i < end; i++) {
        const idx = indices[i];
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = col * BLOCK, y = row * BLOCK;

        // Each block: random palette colour with slight brightness variation
        const base = palette[Math.floor(Math.random() * palette.length)];
        ctx.fillStyle = base;
        ctx.fillRect(x, y, BLOCK - 1, BLOCK - 1);

        // Occasional lighter "highlight" block
        if (Math.random() < 0.07) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(x, y, BLOCK - 1, BLOCK - 1);
        }
      }
      painted = end;
    }

    const paintTimer = setInterval(() => {
      if (painted < totalBlocks) {
        paintFrame();
      } else {
        // All filled — add a subtle scan-line sweep to show "processing"
        ctx.fillStyle = "rgba(255,255,255,0.015)";
        const scanY = (Date.now() / 8) % CH;
        ctx.fillRect(0, scanY, CW, 3);
      }
    }, 16); // ~60fps

    // Status text below canvas
    const statusEl = document.createElement("div");
    statusEl.style.cssText =
      "font-size:0.8rem;opacity:0.6;display:flex;align-items:center;gap:8px;";

    const dot = document.createElement("span");
    dot.style.cssText =
      "width:7px;height:7px;border-radius:50%;background:#10b981;flex-shrink:0;" +
      "animation:imgDotPulse 0.9s infinite alternate;display:inline-block;";

    const statusText = document.createElement("span");
    const steps = [
      "Understanding your prompt…",
      "Composing the layout…",
      "Drawing shapes and lines…",
      "Adding labels…",
      "Refining details…",
      "Almost ready…",
    ];
    let stepIdx = 0;
    statusText.textContent = steps[0];

    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      statusText.textContent = steps[stepIdx];
    }, 2200);

    statusEl.appendChild(dot);
    statusEl.appendChild(statusText);

    imgLoaderWrap.appendChild(canvas);
    imgLoaderWrap.appendChild(statusEl);
    content.appendChild(imgLoaderWrap);
    bubble.appendChild(content);
    botRow.appendChild(bubble);
    chatWindow.appendChild(botRow);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
      const res = await fetch(`${backendBaseUrl}/api/generate-image`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          prompt,
          board:       boardSelect?.value      || "ICSE",
          class_level: classLevelSelect?.value || "10",
          subject:     subjectSelect?.value    || "General",
        }),
      });

      const data = await res.json();
      clearInterval(stepTimer);
      clearInterval(paintTimer);
      imgLoaderWrap.remove();

      if (!res.ok || data.error) {
        content.innerText = "Could not generate image: " + (data.detail || data.error || `HTTP ${res.status}`);
        console.error("Image gen error:", data);
      } else {
        const imgSrc = `data:${data.mimeType};base64,${data.image}`;

        // ── Gemini-style image card: image + hover toolbar on top ──
        const card = document.createElement("div");
        card.style.cssText =
          "position:relative;display:inline-block;max-width:100%;border-radius:14px;" +
          "overflow:hidden;cursor:zoom-in;";

        const imgEl = document.createElement("img");
        imgEl.src   = imgSrc;
        imgEl.alt   = prompt;
        imgEl.style.cssText =
          "display:block;max-width:100%;max-height:480px;object-fit:contain;" +
          "border-radius:14px;border:1px solid rgba(255,255,255,0.08);";

        // Toolbar that slides in on hover (top-right, like Gemini)
        const toolbar = document.createElement("div");
        toolbar.style.cssText =
          "position:absolute;top:8px;right:8px;display:flex;gap:6px;" +
          "opacity:0;transition:opacity 0.2s;pointer-events:none;";

        function toolBtn(icon, title) {
          const b = document.createElement("button");
          b.type = "button";
          b.title = title;
          b.innerHTML = icon;
          b.style.cssText =
            "background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);border:none;" +
            "color:#fff;border-radius:8px;width:34px;height:34px;cursor:pointer;" +
            "font-size:15px;display:flex;align-items:center;justify-content:center;" +
            "transition:background 0.15s;";
          b.addEventListener("mouseenter", () => b.style.background = "rgba(0,0,0,0.85)");
          b.addEventListener("mouseleave", () => b.style.background = "rgba(0,0,0,0.65)");
          return b;
        }

        // Download button
        const dlBtn = toolBtn("⬇", "Download image");
        dlBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const a = document.createElement("a");
          a.href     = imgSrc;
          a.download = "teengro-diagram.png";
          a.click();
        });

        // Open full size button
        const expandBtn = toolBtn("⤢", "View full size");
        expandBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openLightbox(imgSrc, prompt);
        });

        toolbar.appendChild(expandBtn);
        toolbar.appendChild(dlBtn);

        // Show/hide toolbar on hover
        card.addEventListener("mouseenter", () => {
          toolbar.style.opacity = "1";
          toolbar.style.pointerEvents = "auto";
        });
        card.addEventListener("mouseleave", () => {
          toolbar.style.opacity = "0";
          toolbar.style.pointerEvents = "none";
        });

        // Click image to open lightbox
        imgEl.addEventListener("click", () => openLightbox(imgSrc, prompt));

        card.appendChild(imgEl);
        card.appendChild(toolbar);
        content.appendChild(card);

        // Caption
        const caption = document.createElement("div");
        caption.style.cssText = "font-size:0.75rem;opacity:0.45;margin-top:6px;";
        caption.textContent = prompt;
        content.appendChild(caption);
      }
    } catch (err) {
      clearInterval(stepTimer);
      clearInterval(paintTimer);
      imgLoaderWrap.remove();
      content.innerText = "Network error generating image.";
      console.error(err);
    }

    questionInput.disabled = false;
    sendBtn.disabled       = false;
    questionInput.focus();
  }

  /* ════════════════════════════════
     SEND / STOP STATE
  ════════════════════════════════ */
  let isStreaming  = false;
  let abortStream  = null; // function to call to cancel current stream
  const sendIcon   = document.getElementById("sendIcon");
  const stopIcon   = document.getElementById("stopIcon");

  function setStreamingUI(streaming) {
    isStreaming = streaming;
    if (sendIcon) sendIcon.style.display = streaming ? "none"  : "";
    if (stopIcon) stopIcon.style.display = streaming ? ""      : "none";
    if (sendBtn)  sendBtn.title          = streaming ? "Stop"  : "Send";
    if (sendBtn)  sendBtn.type           = streaming ? "button": "submit";
  }

  /* ════════════════════════════════
     SEND QUESTION
  ════════════════════════════════ */
  async function sendQuestion(e, forceQuestion = null) {
    e?.preventDefault();

    // If currently streaming, stop it
    if (isStreaming) {
      abortStream?.();
      return;
    }

    if (!questionInput || !sendBtn || !chatWindow) return;

    const question = forceQuestion ?? questionInput.value.trim();
    const hasFiles  = attachedFiles.length > 0;
    if (!question && !hasFiles) return;

    // ── Track question + update streak (fires on every real send) ──
    trackQuestionAndStreak();

    // ── History session: start or continue ──
    if (!forceQuestion) {
      const meta = {
        board:       boardSelect?.value      || "ICSE",
        class_level: classLevelSelect?.value || "10",
        subject:     subjectSelect?.value    || "General",
      };
      if (!window._activeHistorySessionId) {
        // await so we have the real session ID before saving
        window._activeHistorySessionId = await startHistorySession(question, meta);
      }
      // Await the user message save so it completes before the bot response
      // (prevents race condition where slow user-save overwrites the bot response)
      await saveChatMessage(window._activeHistorySessionId, "user", question);
    }

    // ── Route to image generation if no files and prompt matches ──
    if (!hasFiles && isImageRequest(question)) {
      generateImage(question);
      return;
    }

    const filesToSend = [...attachedFiles];
    const images      = filesToSend.filter(f => f.type === "image");
    const nonImages   = filesToSend.filter(f => f.type !== "image");

    /* ── User bubble ── */
    const userRow    = document.createElement("div");
    userRow.className = "message-row user";
    const userBubble = document.createElement("div");
    userBubble.className = "message-bubble";

    if (images.length) {
      const grid = document.createElement("div");
      grid.className = "chat-img-grid";
      images.forEach(f => {
        const img = document.createElement("img");
        img.src = f.dataURL;
        img.alt = f.file.name;
        img.style.cursor = "zoom-in";
        img.title = "Click to view full size";
        img.addEventListener("click", () => openLightbox(f.dataURL, f.file.name));
        grid.appendChild(img);
      });
      userBubble.appendChild(grid);
    }

    if (nonImages.length) {
      const fl = document.createElement("div");
      fl.style.cssText = "font-size:0.78rem;opacity:0.65;margin-bottom:4px;";
      fl.textContent   = nonImages.map(f =>
        (f.type === "pdf" ? "📄 " : "📎 ") + f.file.name
      ).join("   ");
      userBubble.appendChild(fl);
    }

    if (question) {
      const txt = document.createElement("div");
      txt.innerText = question;
      userBubble.appendChild(txt);
    }

    userRow.appendChild(userBubble);
    document.getElementById("chatEmptyState")?.remove();
    chatWindow.appendChild(userRow);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    /* ── File payload ── */
    const filePayload = filesToSend
      .filter(f => f.base64)
      .map(f => ({ name: f.file.name, mimeType: f.mimeType, base64: f.base64 }));

    /* ── Clear state (skip when regenerating) ── */
    if (!forceQuestion) {
      questionInput.value = "";
      questionInput.style.height = "auto";
      attachedFiles = [];
      if (chipsRow) { chipsRow.innerHTML = ""; chipsRow.classList.remove("has-files"); }
    }

    questionInput.disabled = true;
    setStreamingUI(true);

    /* ── Bot loader bubble ── */
    const botRow  = document.createElement("div");
    botRow.className = "message-row bot";
    const bubble  = document.createElement("div");
    bubble.className = "message-bubble";
    const content = document.createElement("div");
    const loader  = document.createElement("div");
    loader.className = "gemini-loader";
    loader.innerHTML = "<span></span><span></span><span></span>";
    content.appendChild(loader);
    bubble.appendChild(content);
    botRow.appendChild(bubble);
    chatWindow.appendChild(botRow);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    /* ── Shared mutable stop flag (object so closure always sees latest) ── */
    const ctrl = { cancelled: false };

    /* ── Word-by-word fade queue ── */
    let wordQueue = [];
    let rafId    = null;
    let lastFlush = 0;
    const WORD_INTERVAL = 28; // ms between words (visible tab)

    /* Drain the entire queue instantly — used when tab is hidden */
    function drainQueue() {
      while (wordQueue.length) {
        const token = wordQueue.shift();
        const span  = document.createElement("span");
        span.className = "stream-word";
        span.innerHTML = token;
        content.appendChild(span);
      }
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function flushWords(ts) {
      if (ctrl.cancelled) { rafId = null; return; }

      /* If tab hidden: drain everything immediately so queue never backs up */
      if (document.visibilityState === "hidden") {
        drainQueue();
        rafId = null;
        if (streamDone) finishStream();
        return;
      }

      if (wordQueue.length) {
        /* Pace output: emit one token per WORD_INTERVAL ms */
        if (ts - lastFlush >= WORD_INTERVAL) {
          const token = wordQueue.shift();
          const span  = document.createElement("span");
          span.className = "stream-word";
          span.innerHTML = token;
          content.appendChild(span);
          chatWindow.scrollTop = chatWindow.scrollHeight;
          lastFlush = ts;
        }
        rafId = requestAnimationFrame(flushWords);
      } else {
        rafId = null;
        if (streamDone) finishStream();
      }
    }

    function finishStream() {
      // finishStream — UI cleanup only, bot save happens at stream end
      if (ctrl.cancelled) return;
      abortStream = null;
      questionInput.disabled = false;
      setStreamingUI(false);
      questionInput.focus();
      addMessageActions(botRow, content, question, () => sendQuestion(null, question));
      // Bot response is saved at stream end (event: end) — not here
    }

    /* When user returns to tab: drain any queued words instantly then resume RAF */
    const onVisibilityResume = () => {
      if (document.visibilityState === "visible" && wordQueue.length && !rafId) {
        drainQueue();
        if (streamDone) finishStream();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityResume);

    /**
     * Split htmlText into tokens that never break an HTML tag.
     * Text nodes → split on whitespace boundaries.
     * Element nodes (<mark>, <br>…) → one atomic token each.
     */
    function splitHtmlSafe(htmlText) {
      const tmp = document.createElement("div");
      tmp.innerHTML = htmlText;
      const tokens = [];
      tmp.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parts = node.textContent.split(/(?=\s)|(?<=\s)/);
          parts.forEach(p => { if (p) tokens.push(p); });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          tokens.push(node.outerHTML);
        }
      });
      return tokens;
    }

    /* rawBuf holds incomplete *...* spans that haven't closed yet across chunks */
    let rawBuf = "";
    /* fullRawText accumulates the COMPLETE raw response for history saving */
    let fullRawText = "";

    function enqueueText(rawChunk) {
      if (ctrl.cancelled) return;

      /* Accumulate full raw response for history saving */
      fullRawText += rawChunk;

      /* Accumulate raw text and process only complete *...* pairs */
      rawBuf += rawChunk;

      /* Split into: complete highlighted segments + trailing incomplete remainder */
      /* Strategy: find last * position — if odd number of * → last one is unclosed */
      const starCount = (rawBuf.match(/\*/g) || []).length;
      let toProcess = rawBuf;
      if (starCount % 2 !== 0) {
        /* Odd asterisks: hold back from the last * onwards */
        const lastStar = rawBuf.lastIndexOf("*");
        toProcess = rawBuf.slice(0, lastStar);
        rawBuf    = rawBuf.slice(lastStar);
      } else {
        rawBuf = "";
      }

      if (!toProcess) return;

      const htmlText = formatGeminiResponse(toProcess);
      const parts = splitHtmlSafe(htmlText);
      for (const p of parts) { if (p) wordQueue.push(p); }
      if (!rafId) rafId = requestAnimationFrame(flushWords);
    }

    /* Flush any remaining buffer when stream ends */
    function flushRawBuf() {
      if (!rawBuf) return;
      const htmlText = formatGeminiResponse(rawBuf);
      rawBuf = "";
      const parts = splitHtmlSafe(htmlText);
      for (const p of parts) { if (p) wordQueue.push(p); }
      if (!rafId) rafId = requestAnimationFrame(flushWords);
    }

    /* ── AbortController for fetch ── */
    const ac = new AbortController();
    let streamDone = false;
    let savedOnAbort = false; // Flag to prevent duplicate saves

    /* ── Wire stop button: show copy/regenerate/feedback even when stopped ── */
    abortStream = () => {
      ctrl.cancelled = true;
      wordQueue = [];
      rawBuf = "";
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      document.removeEventListener("visibilitychange", onVisibilityResume);
      ac.abort();
      if (loader.parentNode) loader.remove();
      questionInput.disabled = false;
      setStreamingUI(false);
      questionInput.focus();
      
      /* Save only the PARTIAL response that was actually displayed */
      /* Use replaceLastBot=true to replace any existing bot message for this Q&A */
      if (!savedOnAbort && window._activeHistorySessionId && !forceQuestion) {
        savedOnAbort = true;
        // Get the actual text content that was rendered to screen
        const partialText = content.innerText || content.textContent || "";
        if (partialText.trim()) {
          console.log("[History] stopped early — saving partial response, length:", partialText.trim().length);
          // Pass true to replace the last bot message instead of adding
          saveChatMessage(window._activeHistorySessionId, "bot", partialText.trim(), true);
        }
      }
      
      /* Show action buttons (copy, thumbs, regenerate) for partial answer */
      if (botRow && content && !botRow.querySelector(".msg-actions")) {
        addMessageActions(botRow, content, question, () => sendQuestion(null, question));
      }
    };

    let firstChunk = false;

    try {
      const response = await fetch(`${backendBaseUrl}/api/ask`, {
        method:  "POST",
        signal:  ac.signal,
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body:    JSON.stringify({
          board:       boardSelect?.value      || "ICSE",
          class_level: classLevelSelect?.value || "10",
          subject:     subjectSelect?.value    || "General",
          chapter:     chapterInput?.value     || "General",
          question,
          model:       selectedModel,
          files:       filePayload,
        }),
      });

      if (!response.ok || !response.body) throw new Error("Server error");

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (!ctrl.cancelled) {
        const { done, value } = await reader.read();
        if (done || ctrl.cancelled) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();

        for (const part of parts) {
          if (ctrl.cancelled) break;
          if (part.startsWith("data:")) {
            const jsonStr = part.replace("data:", "").trim();
            if (!jsonStr) continue;
            let text;
            try { text = JSON.parse(jsonStr); } catch { continue; }
            if (!text) continue;
            if (!firstChunk) { loader.remove(); firstChunk = true; }
            enqueueText(text); // formatGeminiResponse applied inside enqueueText via rawBuf
          }
          if (part.includes("event: error")) { if (loader.parentNode) loader.remove(); content.innerText = "Server error."; }
          if (part.includes("event: end")) {
            if (loader.parentNode) loader.remove();
            // ── Save bot response HERE — fullRawText is complete at stream end ──
            // Skip if already saved on abort
            if (!savedOnAbort && window._activeHistorySessionId && !forceQuestion && fullRawText.trim()) {
              window._botSavedForSession = window._activeHistorySessionId; // prevent double-save
              console.log("[History] stream ended — saving bot response, length:", fullRawText.trim().length);
              saveChatMessage(window._activeHistorySessionId, "bot", fullRawText.trim(), true);
            }
            reader.cancel();
            break;
          }
        }
      }
    } catch (err) {
      // AbortError is expected when user clicks stop — ignore it silently
      if (err.name !== "AbortError" && !ctrl.cancelled) {
        console.error(err);
        if (loader.parentNode) loader.remove();
        content.innerText = "Network error. Backend unreachable.";
      }
    }

    /* Stream finished — flush any leftover rawBuf, then let RAF drain the queue. */
    if (!ctrl.cancelled) {
      flushRawBuf();          // emit any partial *...* held back

      // ── Save bot response (fallback if server didn't send event:end) ──
      // Skip if already saved on abort
      if (!savedOnAbort && window._activeHistorySessionId && !forceQuestion && fullRawText.trim()) {
        // Use a flag to avoid double-saving if event:end already saved it
        if (!window._botSavedForSession || window._botSavedForSession !== window._activeHistorySessionId) {
          window._botSavedForSession = window._activeHistorySessionId;
          console.log("[History] post-loop save — bot response length:", fullRawText.trim().length);
          saveChatMessage(window._activeHistorySessionId, "bot", fullRawText.trim(), true);
        }
      }

      streamDone = true;
      if (!rafId && !wordQueue.length) {
        finishStream();       // queue already empty: finish immediately
      }
      // otherwise flushWords/drainQueue will call finishStream() when queue empties
    }
  }

  /* ── Send / Stop bindings ── */
  sendBtn?.addEventListener("click", (e) => { e.preventDefault(); sendQuestion(e); });
  questionForm?.addEventListener("submit", (e) => sendQuestion(e));
  questionInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(e); }
  });

  /* ════════════════════════════════
     VOICE INPUT (Web Speech API — free)
  ════════════════════════════════ */
  if (voiceBtn && questionInput) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      voiceBtn.style.opacity = "0.35";
      voiceBtn.style.cursor  = "not-allowed";
      voiceBtn.title = "Voice input not supported in this browser";
    } else {
      const recog = new SpeechRecognition();
      recog.continuous  = true;
      recog.interimResults = true;
      recog.maxAlternatives = 3;
      recog.lang = "en-IN";

      let listening = false;
      let committed = "";

      function updateTextarea(display) {
        if (!questionInput) return;
        questionInput.value = display;
        growTextarea();
      }

      function getBestTranscript(result) {
        if (!result || !result.length) return "";
        let best = "";
        let bestConf = 0;
        for (let j = 0; j < result.length; j++) {
          const c = result[j];
          const t = (c.transcript || "").trim();
          const conf = typeof c.confidence === "number" ? c.confidence : 0.9;
          if (t && conf > bestConf) { bestConf = conf; best = t; }
        }
        return best || (result[0] && result[0].transcript) || "";
      }

      voiceBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (listening) {
          recog.stop();
          return;
        }
        committed = (questionInput.value || "").trim();
        if (committed) committed += " ";
        try {
          recog.start();
        } catch (err) {
          if (questionInput) questionInput.placeholder = "Click again to start voice.";
          setTimeout(() => { if (questionInput) questionInput.placeholder = "Ask anything…"; }, 2000);
        }
      });

      recog.onstart = () => {
        listening = true;
        voiceBtn.classList.add("recording");
        voiceBtn.title = "Tap to stop";
        if (questionInput) questionInput.placeholder = "Listening…";
      };

      recog.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          const t = getBestTranscript(r);
          if (!t) continue;
          if (r.isFinal) {
            committed = (committed + " " + t).trimStart();
          } else {
            interim = t;
          }
        }
        const display = interim ? (committed + " " + interim).trim() : committed;
        updateTextarea(display);
      };

      recog.onend = () => {
        listening = false;
        voiceBtn.classList.remove("recording");
        voiceBtn.title = "Voice input";
        if (questionInput) {
          questionInput.placeholder = "Ask anything…";
          updateTextarea(committed);
          if (committed) questionInput.focus();
        }
      };

      recog.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        listening = false;
        voiceBtn.classList.remove("recording");
        voiceBtn.title = "Voice input";
        const msgs = {
          "audio-capture": "No microphone found.",
          "not-allowed":   "Microphone access denied.",
          "network":       "Network error.",
        };
        if (questionInput) {
          questionInput.placeholder = msgs[event.error] || "Voice error.";
          setTimeout(() => { questionInput.placeholder = "Ask anything…"; }, 3000);
        }
      };
    }
  }

  // ── Chat history panel (dashboard only) ──
  if (isDashboard()) {
    injectHistoryPanel();
    document.getElementById("historyBtn")?.addEventListener("click", openHistoryPanel);
    // New chat button: reset session ID and clear window
    document.getElementById("newChatBtn")?.addEventListener("click", () => {
      window._activeHistorySessionId = null;
      // Clear any lingering buffer entries for fresh start
      const cw = document.getElementById("chatWindow");
      if (cw) {
        cw.innerHTML = "";
        // Re-insert empty state
        const es = document.createElement("div");
        es.className = "chat-empty-state";
        es.id = "chatEmptyState";
        es.setAttribute("aria-hidden", "true");
        es.innerHTML = `<p class="chat-empty-greeting" id="chatEmptyGreeting"></p>
          <div class="chat-empty-icon">💬</div>
          <p class="chat-empty-title">Ask anything</p>
          <p class="chat-empty-hint">Maths, Physics, Chemistry — get step-by-step explanations.</p>`;
        cw.appendChild(es);
        updateDashboardGreeting();
      }
    });
  }

}); // end DOMContentLoaded
/* ═══════════════════════════════════════════════════════════════
   PROFILE  ·  STREAK  ·  TIME TRACKING  ·  PANEL (ALL PAGES)
═══════════════════════════════════════════════════════════════ */

/* ── Small utilities ── */
function todayStr() { return new Date().toISOString().split("T")[0]; }

// Format time with seconds for real-time display (takes minutes as input)
function fmtTime(totalMinutes) {
  if (!totalMinutes || totalMinutes < 0) return "0s";
  
  const totalSeconds = Math.floor(totalMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    // Show h m s format: "2h 15m 30s"
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    // Show m s format: "15m 30s"
    return `${minutes}m ${seconds}s`;
  } else {
    // Show s format: "30s"
    return `${seconds}s`;
  }
}

// Format time without seconds (for saved stats display)
function fmtTimeCompact(totalMinutes) {
  if (!totalMinutes || totalMinutes < 1) return "0m";
  if (totalMinutes < 60) return Math.round(totalMinutes) + "m";
  const h = Math.floor(totalMinutes / 60), m = Math.round(totalMinutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

/* ── Streak ── */
function computeStreak(lastDate, currentStreak) {
  const today = todayStr();
  if (lastDate === today) return { streak: currentStreak, lastDate: today };
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split("T")[0];
  if (lastDate === yStr) return { streak: (currentStreak || 0) + 1, lastDate: today };
  return { streak: 1, lastDate: today };
}

/* ── Page detection helpers ── */
function isDashboard() {
  const path = window.location.pathname || "";
  return path.endsWith("dashboard.html") || path.includes("dashboard");
}

/* ── Session time tracker (ALL PAGES) ── */
let sessionStartTime = Date.now();
let pendingMinutes   = 0;   // accumulate time across visibility changes
let lastKnownDBTotal = 0;   // for live display (DB total + unsaved)
let isUserLoggedIn   = false; // track login state for time tracking

// Check if user is logged in (for time tracking purposes)
async function checkUserLoggedIn() {
  if (!supabaseClient) return false;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    isUserLoggedIn = !!session;
    return isUserLoggedIn;
  } catch (e) {
    return false;
  }
}

// Helper to check if we're on a trackable page (exclude auth pages)
function isTrackablePage() {
  const path = window.location.pathname || "";
  const excludedPages = ["login.html", "signup.html", "reset-password.html", "offline.html"];
  return !excludedPages.some(p => path.endsWith(p));
}

function getElapsedMins() {
  return (Date.now() - sessionStartTime) / 60000;
}

// Called on hide/unload — accumulates elapsed time on ALL trackable pages
function accumulateTime() {
  if (!isTrackablePage() || !isUserLoggedIn) return;
  const mins = getElapsedMins();
  if (mins > 0) pendingMinutes += mins;
  sessionStartTime = Date.now();
}

// Persist accumulated time to Supabase (call accumulateTime() before this)
async function flushTimeToDB() {
  if (!supabaseClient || pendingMinutes <= 0) return;
  const toSave = pendingMinutes;
  pendingMinutes = 0;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { 
      pendingMinutes += toSave; 
      isUserLoggedIn = false;
      return; 
    }
    isUserLoggedIn = true;
    const { data: row } = await supabaseClient
      .from("user_profiles")
      .select("total_time_minutes")
      .eq("id", session.user.id)
      .single();
    if (row) {
      const newTotal = (row.total_time_minutes || 0) + toSave;
      lastKnownDBTotal = newTotal;
      await supabaseClient
        .from("user_profiles")
        .update({ total_time_minutes: newTotal })
        .eq("id", session.user.id);
      updateAllTimeDisplays(newTotal);
      
      // Check for study time badges
      const { data: profile } = await supabaseClient
        .from("user_profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (profile) checkAndUnlockBadges(profile);
    } else {
      pendingMinutes += toSave;
    }
  } catch (e) {
    pendingMinutes += toSave;
  }
}

// Update ALL time display elements across both slider panel and profile page
function updateAllTimeDisplays(totalMinutes) {
  const formatted = fmtTime(totalMinutes);
  
  // Slider panel time (id="timeSpent")
  const sliderEl = document.getElementById("timeSpent");
  if (sliderEl) sliderEl.textContent = formatted;
  
  // Profile page time (id="profileTime")
  const profileEl = document.getElementById("profileTime");
  if (profileEl) profileEl.textContent = formatted;
}

// Live display: DB total + pending + current session (updates every second on ALL pages)
function refreshTimeDisplay() {
  if (!isTrackablePage() || !isUserLoggedIn) return;
  
  const liveTotal = lastKnownDBTotal + pendingMinutes + getElapsedMins();
  updateAllTimeDisplays(liveTotal);
  
  // Session indicator (dashboard only)
  const sessionEl = document.getElementById("sessionIndicator");
  if (sessionEl) {
    const mins = Math.floor(getElapsedMins());
    sessionEl.textContent = mins < 1 ? "Studying" : "Studying · " + mins + "m";
  }
}

// Initialize time tracking on page load
async function initTimeTracking() {
  await checkUserLoggedIn();
  if (isUserLoggedIn && isTrackablePage()) {
    // Fetch initial total from DB to set lastKnownDBTotal
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        const { data: row } = await supabaseClient
          .from("user_profiles")
          .select("total_time_minutes")
          .eq("id", session.user.id)
          .single();
        if (row) {
          lastKnownDBTotal = row.total_time_minutes || 0;
          updateAllTimeDisplays(lastKnownDBTotal);
        }
      }
    } catch (e) { /* silent */ }
  }
}

window.addEventListener("beforeunload", () => {
  accumulateTime();
  // Use sendBeacon for reliable flush on unload
  if (supabaseClient && pendingMinutes > 0) {
    // Can't use async on beforeunload, so just accumulate
    // The flush will happen on next page load or visibility change
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    accumulateTime();
    flushTimeToDB();
  } else {
    sessionStartTime = Date.now();
    checkUserLoggedIn().then(() => {
      if (isUserLoggedIn) flushTimeToDB();
    });
  }
});

// Periodic auto-save every 60 seconds on ALL trackable pages
setInterval(() => {
  if (!isTrackablePage() || !isUserLoggedIn) return;
  accumulateTime();
  flushTimeToDB();
}, 60 * 1000);

// Live time display every second on ALL pages
setInterval(() => {
  refreshTimeDisplay();
}, 1000);

/* ── Build profile panel HTML (injected into every page) ── */
function injectProfilePanel() {
  if (document.getElementById("profilePanel")) return; // already injected

  const panelHTML = `
  <div class="profile-overlay" id="profileOverlay"></div>
  <aside class="profile-panel" id="profilePanel">

    <div class="pp-header">
      <h2>My Profile</h2>
      <button class="pp-close" id="profileClose" title="Close">✕</button>
    </div>

    <!-- Logged-out state -->
    <div class="pp-loggedout" id="ppLoggedOut" style="display:none;">
      <div class="pp-lo-icon">👤</div>
      <div class="pp-lo-title">You're not logged in</div>
      <div class="pp-lo-sub">Login to view your profile, streaks, and study stats.</div>
      <a href="login.html" class="pp-lo-btn">Login</a>
      <a href="signup.html" class="pp-lo-btn pp-lo-btn-ghost">Create account</a>
    </div>

    <!-- Logged-in state -->
    <div class="pp-loggedin" id="ppLoggedIn" style="display:none;">

      <!-- Identity -->
      <div class="pp-identity">
        <div class="pp-avatar-wrap" id="ppAvatarWrap">
          <div class="pp-avatar" id="ppAvatar">?</div>
          <label class="pp-avatar-edit" title="Change photo" for="ppPhotoInput">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </label>
          <button class="pp-avatar-remove" id="ppAvatarRemove" title="Remove photo" style="display:none;" onclick="removeAvatar()">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <input type="file" id="ppPhotoInput" accept="image/*" style="display:none;" />
        </div>
        <div class="pp-name" id="ppName">Loading…</div>
        <div style="font-size:0.8rem;font-weight:600;opacity:0.45;" id="ppUsername"></div>
        <div class="pp-email"   id="ppEmail"></div>
        <div class="pp-badge"><span>📚</span><span id="ppBadgeText">Student</span></div>
      </div>

      <!-- Stats -->
      <div class="pp-stats">
        <div class="pp-stat-card streak-active">
          <div class="pp-stat-icon"><span class="streak-flame">🔥</span></div>
          <div class="pp-stat-value" id="streakCount">0</div>
          <div class="pp-stat-label">Day streak</div>
        </div>
        <div class="pp-stat-card">
          <div class="pp-stat-icon">⏱️</div>
          <div class="pp-stat-value" id="timeSpent">0s</div>
          <div class="pp-stat-label">Study time</div>
        </div>
        <div class="pp-stat-card">
          <div class="pp-stat-icon">💬</div>
          <div class="pp-stat-value" id="questionsCount">0</div>
          <div class="pp-stat-label">Questions</div>
        </div>
        <div class="pp-stat-card">
          <div class="pp-stat-icon">🗓️</div>
          <div class="pp-stat-value" id="ppJoinedStat">—</div>
          <div class="pp-stat-label">Member since</div>
        </div>
      </div>

      <!-- Bio -->
      <div class="pp-bio-section" id="ppBioSection">
        <div class="pp-bio-header">
          <span class="pp-bio-label">Bio</span>
          <button class="pp-inline-edit-btn" data-field="bio" title="Edit bio">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>
        <div class="pp-bio-text" id="ppBioText"></div>
        <div class="pp-bio-empty" id="ppBioEmpty" style="display:none;">No bio yet</div>
      </div>

      <!-- Info rows -->
      <div class="pp-info-section">
        <div class="pp-info-row">
          <div class="pp-info-left"><span class="pp-info-icon">🪪</span><span class="pp-info-label">Username</span></div>
          <div class="pp-info-right">
            <span class="pp-info-value" id="ppUsernameRow">—</span>
            <button class="pp-inline-edit-btn" data-field="username" title="Edit username">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
          </div>
        </div>
        <div class="pp-info-row">
          <div class="pp-info-left"><span class="pp-info-icon">🏫</span><span class="pp-info-label">Class</span></div>
          <div class="pp-info-right">
            <span class="pp-info-value" id="ppClass">—</span>
            <button class="pp-inline-edit-btn" data-field="class" title="Edit class">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
          </div>
        </div>
        <div class="pp-info-row">
          <div class="pp-info-left"><span class="pp-info-icon">📋</span><span class="pp-info-label">Board</span></div>
          <div class="pp-info-right">
            <span class="pp-info-value" id="ppBoard">—</span>
            <button class="pp-inline-edit-btn" data-field="board" title="Edit board">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
          </div>
        </div>
        <div class="pp-info-row">
          <div class="pp-info-left"><span class="pp-info-icon">📖</span><span class="pp-info-label">Last subject</span></div>
          <span class="pp-info-value" id="ppLastSubject">—</span>
        </div>
      </div>

      <!-- Achievements / Badges -->
      <div class="pp-badges-section">
        <div class="pp-badges-header">
          <span class="pp-badges-label">🏆 Achievements</span>
          <span class="pp-badges-count" id="ppBadgesCount">0/0</span>
        </div>
        <div class="pp-badges-grid" id="ppBadgesGrid">
          <!-- Badges will be populated by JS -->
        </div>
      </div>

      <!-- Actions -->
      <div class="pp-actions">
        <button class="pp-action-btn logout" onclick="logout()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </div>

    </div><!-- /pp-loggedin -->
  </aside>`;

  document.body.insertAdjacentHTML("afterbegin", panelHTML);
}

/* ── Load profile data into the panel ── */
async function loadProfilePanel() {
  const loggedOut = document.getElementById("ppLoggedOut");
  const loggedIn  = document.getElementById("ppLoggedIn");

  if (!supabaseClient) {
    if (loggedOut) loggedOut.style.display = "";
    if (loggedIn)  loggedIn.style.display  = "none";
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    if (loggedOut) loggedOut.style.display = "";
    if (loggedIn)  loggedIn.style.display  = "none";
    return;
  }

  if (loggedOut) loggedOut.style.display = "none";
  if (loggedIn)  loggedIn.style.display  = "";

  const userId = session.user.id;
  const email  = session.user.email;

  // Fetch profile
  let { data: profile, error: fetchErr } = await supabaseClient
    .from("user_profiles").select("*").eq("id", userId).single();

  if (!profile) {
    // Try to recover from pendingProfile in localStorage
    const pending = localStorage.getItem("pendingProfile");
    const base = pending ? JSON.parse(pending) : {};
    profile = {
      id: userId, full_name: "", username: "", email,
      class_level: "10", board: "ICSE", bio: "",
      streak: 0, last_active_date: null,
      total_time_minutes: 0, questions_count: 0,
      ...base,
    };
    try {
      await supabaseClient.from("user_profiles").upsert({ ...profile });
      localStorage.removeItem("pendingProfile");
    } catch (e) {}
  }

  // Streak is updated only when a question is asked (in trackQuestionAndStreak)
  const newStreak = profile.streak || 0;

  const name      = profile.full_name || email.split("@")[0];
  const initials  = getInitials(name);
  const joined    = new Date(session.user.created_at);
  const joinedStr = joined.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  const el = id => document.getElementById(id);

  // Avatar: show uploaded photo if exists, otherwise initials
  const avatarEl = el("ppAvatar");
  if (avatarEl) {
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      avatarEl.textContent = initials;
    }
  }

  // Show/hide remove button based on whether photo exists
  const removeBtn = el("ppAvatarRemove");
  if (removeBtn) removeBtn.style.display = profile.avatar_url ? "" : "none";

  // Wire photo upload input (once)
  const photoInput = el("ppPhotoInput");
  if (photoInput && !photoInput.dataset.wired) {
    photoInput.dataset.wired = "1";
    photoInput.addEventListener("change", handleAvatarUpload);
  }

  if (el("ppName"))        el("ppName").textContent        = name;
  
  // Update greetings now that ppName is set
  updateDashboardGreeting();
  updateHomeGreeting();
  
  if (el("ppUsername"))    el("ppUsername").textContent    = profile.username ? "@" + profile.username : "";
  if (el("ppEmail"))       el("ppEmail").textContent       = email;
  if (el("ppBadgeText"))   el("ppBadgeText").textContent   = `Class ${profile.class_level} · ${profile.board}`;
  if (el("streakCount"))   el("streakCount").textContent   = newStreak;
  const totalMins = profile.total_time_minutes || 0;
  lastKnownDBTotal = totalMins;
  // Update all time displays (slider panel + profile page)
  updateAllTimeDisplays(totalMins);
  if (el("questionsCount")) el("questionsCount").textContent = profile.questions_count || 0;
  if (el("ppJoinedStat"))  el("ppJoinedStat").textContent  = joinedStr;
  if (el("ppUsernameRow")) el("ppUsernameRow").textContent = profile.username ? "@" + profile.username : "—";
  if (el("ppClass"))       el("ppClass").textContent       = `Class ${profile.class_level}`;
  if (el("ppBoard"))       el("ppBoard").textContent       = profile.board;
  if (el("ppLastSubject")) el("ppLastSubject").textContent = profile.last_subject || "—";

  // Bio
  const bioSection = el("ppBioSection");
  const bioText    = el("ppBioText");
  if (bioText) {
    bioText.textContent = profile.bio || "";
    if (bioSection) bioSection.style.display = profile.bio ? "" : "none";
  }

  // Pre-fill edit form
  if (el("editName"))     el("editName").value     = profile.full_name || "";
  if (el("editUsername")) el("editUsername").value = profile.username  || "";
  if (el("editBio"))      el("editBio").value      = profile.bio       || "";
  if (el("editClass"))    el("editClass").value    = profile.class_level || "10";
  if (el("editBoard"))    el("editBoard").value    = profile.board       || "ICSE";

  // Sync dashboard selects
  const classSelect = document.getElementById("classLevel");
  const boardSelect = document.getElementById("board");
  if (classSelect && profile.class_level) classSelect.value = profile.class_level;
  if (boardSelect && profile.board)       boardSelect.value = profile.board;

  // Nav avatar — show photo or initials
  const navTrigger = document.getElementById("profileTriggerNav");
  if (navTrigger) {
    if (profile.avatar_url) {
      navTrigger.innerHTML = `<img src="${profile.avatar_url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      navTrigger.style.padding = "0";
      navTrigger.style.overflow = "hidden";
    } else {
      navTrigger.textContent = initials;
    }
  }

  // Render badges
  await renderBadges(profile);
}

/* ─────────────────────────────────────────────
   BADGES: CHECK & RENDER
───────────────────────────────────────────── */

// Get user's earned badges from localStorage (synced with Supabase)
function getEarnedBadges() {
  try {
    return JSON.parse(localStorage.getItem("earnedBadges") || "[]");
  } catch {
    return [];
  }
}

// Save earned badges to localStorage
function saveEarnedBadges(badges) {
  localStorage.setItem("earnedBadges", JSON.stringify(badges));
}

// Check if a specific badge requirement is met
function checkBadgeRequirement(badge, profile) {
  const req = badge.requirement;
  
  switch (req.type) {
    case "questions":
      return (profile.questions_count || 0) >= req.value;
    
    case "streak":
      return (profile.streak || 0) >= req.value;
    
    case "study_time":
      return (profile.total_time_minutes || 0) >= req.value;
    
    case "time_of_day":
      const hour = new Date().getHours();
      if (req.value === "night") return hour >= 23 || hour < 4;
      if (req.value === "morning") return hour >= 4 && hour < 6;
      return false;
    
    case "day_of_week":
      const day = new Date().getDay();
      if (req.value === "weekend") return day === 0 || day === 6;
      return false;
    
    default:
      return false;
  }
}

// Check all badges and unlock new ones
async function checkAndUnlockBadges(profile) {
  if (!profile) return;
  
  const earned = getEarnedBadges();
  const newBadges = [];
  
  for (const badge of BADGE_DEFINITIONS) {
    // Skip already earned
    if (earned.includes(badge.id)) continue;
    
    // Check if requirement is met
    if (checkBadgeRequirement(badge, profile)) {
      earned.push(badge.id);
      newBadges.push(badge);
    }
  }
  
  if (newBadges.length > 0) {
    saveEarnedBadges(earned);
    
    // Sync to Supabase
    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        await supabaseClient.from("user_profiles")
          .update({ badges: earned })
          .eq("id", session.user.id);
      }
    }
    
    // Show toast for each new badge
    for (const badge of newBadges) {
      showBadgeToast(badge);
    }
    
    // Re-render badges grid
    renderBadges(profile);
  }
  
  return newBadges;
}

// Render badges in the profile panel
async function renderBadges(profile) {
  const grid = document.getElementById("ppBadgesGrid");
  const countEl = document.getElementById("ppBadgesCount");
  if (!grid) return;
  
  // Sync from Supabase if available
  if (supabaseClient && profile.badges) {
    saveEarnedBadges(profile.badges);
  }
  
  const earned = getEarnedBadges();
  const total = BADGE_DEFINITIONS.length;
  const earnedCount = earned.length;
  
  if (countEl) countEl.textContent = `${earnedCount}/${total}`;
  
  grid.innerHTML = "";
  
  for (const badge of BADGE_DEFINITIONS) {
    const isEarned = earned.includes(badge.id);
    const earnedClass = isEarned ? "earned" : "locked";
    
    const item = document.createElement("div");
    item.className = `pp-badge-item ${earnedClass}`;
    item.innerHTML = `
      <span class="pp-badge-icon">${badge.icon}</span>
      <span class="pp-badge-name">${badge.name}</span>
    `;
    
    // Click to show badge info
    item.addEventListener("click", () => showBadgeInfo(badge, isEarned));
    
    grid.appendChild(item);
  }
}

// Show badge info popup
function showBadgeInfo(badge, isEarned) {
  // Remove existing popup
  document.querySelector(".badge-info-popup")?.remove();
  
  const popup = document.createElement("div");
  popup.className = "badge-info-popup";
  popup.innerHTML = `
    <div class="badge-info-overlay"></div>
    <div class="badge-info-card ${isEarned ? 'earned' : 'locked'}">
      <div class="badge-info-icon">${badge.icon}</div>
      <div class="badge-info-name">${badge.name}</div>
      <div class="badge-info-desc">${badge.desc}</div>
      <div class="badge-info-status">${isEarned ? '✓ Unlocked' : '🔒 Locked'}</div>
      <button class="badge-info-close">Got it</button>
    </div>
  `;
  
  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add("open"));
  
  const close = () => {
    popup.classList.remove("open");
    setTimeout(() => popup.remove(), 200);
  };
  
  popup.querySelector(".badge-info-overlay").addEventListener("click", close);
  popup.querySelector(".badge-info-close").addEventListener("click", close);
}

// Show toast notification for new badge
function showBadgeToast(badge) {
  // Remove existing badge toast if any
  const existing = document.querySelector(".badge-toast");
  if (existing) existing.remove();
  
  const toast = document.createElement("div");
  toast.className = "badge-toast";
  toast.innerHTML = `
    <div class="badge-toast-icon">${badge.icon}</div>
    <div class="badge-toast-content">
      <div class="badge-toast-title">🎉 Badge Unlocked!</div>
      <div class="badge-toast-name">${badge.name}</div>
      <div class="badge-toast-desc">${badge.desc}</div>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });
  
  // Remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Check time-based badges when user is active
function checkTimeBadges() {
  const earned = getEarnedBadges();
  const hour = new Date().getHours();
  const day = new Date().getDay();
  
  let changed = false;
  
  // Night Owl: 11 PM - 4 AM
  if (!earned.includes("night_owl") && (hour >= 23 || hour < 4)) {
    earned.push("night_owl");
    changed = true;
    const badge = BADGE_DEFINITIONS.find(b => b.id === "night_owl");
    if (badge) showBadgeToast(badge);
  }
  
  // Early Bird: 4 AM - 6 AM
  if (!earned.includes("early_bird") && hour >= 4 && hour < 6) {
    earned.push("early_bird");
    changed = true;
    const badge = BADGE_DEFINITIONS.find(b => b.id === "early_bird");
    if (badge) showBadgeToast(badge);
  }
  
  // Weekend Warrior
  if (!earned.includes("weekend_warrior") && (day === 0 || day === 6)) {
    earned.push("weekend_warrior");
    changed = true;
    const badge = BADGE_DEFINITIONS.find(b => b.id === "weekend_warrior");
    if (badge) showBadgeToast(badge);
  }
  
  if (changed) {
    saveEarnedBadges(earned);
    // Sync to Supabase
    syncBadgesToSupabase(earned);
  }
}

// Sync badges to Supabase
async function syncBadgesToSupabase(badges) {
  if (!supabaseClient) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await supabaseClient.from("user_profiles")
      .update({ badges })
      .eq("id", session.user.id);
  }
}

/* ─────────────────────────────────────────────
   SHARE CHAT SNIPPET
───────────────────────────────────────────── */

// Open share modal
function openShareModal(question, answer) {
  // Remove existing modal if any
  document.querySelector(".share-modal")?.remove();
  
  const modal = document.createElement("div");
  modal.className = "share-modal";
  modal.innerHTML = `
    <div class="share-overlay"></div>
    <div class="share-card">
      <div class="share-header">
        <h3>Share this response</h3>
        <button class="share-close" title="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="share-preview">
        <div class="share-preview-q">
          <span class="share-preview-label">Question</span>
          <p>${escapeHtml(question.slice(0, 150))}${question.length > 150 ? '...' : ''}</p>
        </div>
        <div class="share-preview-a">
          <span class="share-preview-label">Answer</span>
          <p>${escapeHtml(answer.slice(0, 200))}${answer.length > 200 ? '...' : ''}</p>
        </div>
      </div>
      <div class="share-link-section" style="display:none;">
        <div class="share-link-wrap">
          <input type="text" class="share-link-input" readonly />
          <button class="share-copy-btn">Copy</button>
        </div>
        <p class="share-link-note">Anyone with this link can view this snippet</p>
      </div>
      <div class="share-actions">
        <button class="share-generate-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Generate shareable link
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Animate in
  requestAnimationFrame(() => modal.classList.add("open"));
  
  // Close handlers
  const closeModal = () => {
    modal.classList.remove("open");
    setTimeout(() => modal.remove(), 300);
  };
  
  modal.querySelector(".share-overlay").addEventListener("click", closeModal);
  modal.querySelector(".share-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", escHandler);
    }
  });
  
  // Generate link button
  const generateBtn = modal.querySelector(".share-generate-btn");
  const linkSection = modal.querySelector(".share-link-section");
  const linkInput = modal.querySelector(".share-link-input");
  const copyBtn = modal.querySelector(".share-copy-btn");
  
  generateBtn.addEventListener("click", async () => {
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="share-spinner"></span> Generating...';
    
    try {
      const snippetId = await saveSnippetToSupabase(question, answer);
      const shareUrl = `${window.location.origin}/snippet.html?id=${snippetId}`;
      
      linkInput.value = shareUrl;
      linkSection.style.display = "block";
      generateBtn.style.display = "none";
    } catch (err) {
      generateBtn.disabled = false;
      generateBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Generate shareable link
      `;
      alert("Failed to generate link. Please try again.");
    }
  });
  
  // Copy button
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(linkInput.value).then(() => {
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 2000);
    });
  });
}

// Escape HTML for display (used by share modal and elsewhere)
// NOTE: There's another escapeHtml function at line ~3854. Both are identical.

// Save snippet to Supabase
async function saveSnippetToSupabase(question, answer) {
  if (!supabaseClient) throw new Error("Supabase not available");
  
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  // Get user profile for sharer info
  let sharerName = "Anonymous";
  let sharerAvatar = null;
  let sharerClass = null;
  let sharerBoard = null;
  
  if (session?.user?.id) {
    const { data: profile } = await supabaseClient
      .from("user_profiles")
      .select("full_name, username, avatar_url, class_level, board")
      .eq("id", session.user.id)
      .single();
    
    if (profile) {
      sharerName = profile.full_name || profile.username || "Student";
      sharerAvatar = profile.avatar_url || null;
      sharerClass = profile.class_level || null;
      sharerBoard = profile.board || null;
    }
  }
  
  // Generate a short unique ID
  const snippetId = generateSnippetId();
  
  const snippet = {
    id: snippetId,
    question: question,
    answer: answer,
    user_id: session?.user?.id || null,
    sharer_name: sharerName,
    sharer_avatar: sharerAvatar,
    sharer_class: sharerClass,
    sharer_board: sharerBoard,
    created_at: new Date().toISOString(),
  };
  
  const { error } = await supabaseClient
    .from("shared_snippets")
    .insert(snippet);
  
  if (error) throw error;
  
  return snippetId;
}

// Generate a short random ID for snippets
function generateSnippetId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/* ── Handle avatar photo upload ── */
async function handleAvatarUpload(e) {
  const file = e.target.files?.[0];
  if (!file || !supabaseClient) return;

  // Validate: image, max 3MB
  if (!file.type.startsWith("image/")) {
    alert("Please select an image file.");
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    alert("Image must be under 3MB.");
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  // Show uploading state
  const avatarEl  = document.getElementById("ppAvatar");
  const navEl     = document.getElementById("profileTriggerNav");
  const origInner = avatarEl?.innerHTML;
  if (avatarEl) avatarEl.innerHTML = '<span style="font-size:0.7rem;opacity:0.6;">…</span>';

  try {
    const ext      = file.name.split(".").pop();
    const path     = `${session.user.id}/avatar.${ext}`;
    const bucket   = "avatars";

    // Upload to Supabase Storage
    const { error: upErr } = await supabaseClient.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) throw upErr;

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(path);
    const avatarUrl = urlData?.publicUrl + "?t=" + Date.now(); // bust cache

    // Save URL to profile
    await supabaseClient
      .from("user_profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", session.user.id);

    // Update UI
    const imgHtml = `<img src="${avatarUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    if (avatarEl) avatarEl.innerHTML = imgHtml;
    if (navEl) {
      navEl.innerHTML = imgHtml;
      navEl.style.padding = "0";
      navEl.style.overflow = "hidden";
    }
    // Show remove button now that a photo exists
    const removeBtn = document.getElementById("ppAvatarRemove");
    if (removeBtn) removeBtn.style.display = "";
  } catch (err) {
    if (avatarEl) avatarEl.innerHTML = origInner || "?";
    alert("Upload failed. Make sure the 'avatars' storage bucket exists in Supabase.");
  } finally {
    e.target.value = ""; // allow re-upload same file
  }
}

/* ── Remove avatar photo ── */
async function removeAvatar() {
  if (!supabaseClient) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const avatarEl  = document.getElementById("ppAvatar");
  const navEl     = document.getElementById("profileTriggerNav");
  const removeBtn = document.getElementById("ppAvatarRemove");

  try {
    // Delete from storage — path is userId/avatar.*
    const { data: files } = await supabaseClient.storage
      .from("avatars")
      .list(session.user.id);

    if (files && files.length > 0) {
      const paths = files.map(f => `${session.user.id}/${f.name}`);
      await supabaseClient.storage.from("avatars").remove(paths);
    }

    // Clear avatar_url in profile
    await supabaseClient
      .from("user_profiles")
      .update({ avatar_url: null })
      .eq("id", session.user.id);

    // Revert UI to initials
    const name     = document.getElementById("ppName")?.textContent || session.user.email;
    const initials = getInitials(name);

    if (avatarEl) {
      avatarEl.textContent = initials;
    }
    if (navEl) {
      navEl.textContent = initials;
      navEl.style.padding = "";
      navEl.style.overflow = "";
      navEl.innerHTML = initials; // clear any img
    }
    if (removeBtn) removeBtn.style.display = "none";

  } catch (err) {
    alert("Could not remove photo. Try again.");
  }
}

/* ── Save profile edits ── */
async function saveProfileEdits() {
  if (!supabaseClient) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const name        = document.getElementById("editName")?.value.trim() || "";
  const newUsername = document.getElementById("editUsername")?.value.trim().toLowerCase() || "";
  const bio         = document.getElementById("editBio")?.value.trim() || "";
  const cls         = document.getElementById("editClass")?.value;
  const board       = document.getElementById("editBoard")?.value;
  const msgEl       = document.getElementById("ppSaveMsg");

  const setMsg = (txt, color = "#f87171") => {
    if (msgEl) { msgEl.textContent = txt; msgEl.style.color = color; }
  };

  if (newUsername) {
    if (!/^[a-zA-Z0-9_.]+$/.test(newUsername)) { setMsg("Username: letters, numbers, _ and . only."); return; }
    if (newUsername.length < 3) { setMsg("Username must be at least 3 characters."); return; }
    const { data: taken } = await supabaseClient.from("user_profiles")
      .select("id").eq("username", newUsername).neq("id", session.user.id).limit(1);
    if (taken && taken.length > 0) { setMsg("Username already taken."); return; }
  }

  try {
    const ppSaveBtn = document.getElementById("ppSaveBtn");
    if (ppSaveBtn) { ppSaveBtn.disabled = true; ppSaveBtn.textContent = "Saving…"; }

    await supabaseClient.from("user_profiles")
      .update({ full_name: name, username: newUsername, bio, class_level: cls, board })
      .eq("id", session.user.id);

    const el = id => document.getElementById(id);
    if (el("ppName"))      el("ppName").textContent      = name || session.user.email.split("@")[0];
    if (el("ppAvatar"))    el("ppAvatar").textContent    = getInitials(name || session.user.email);
    if (el("ppUsername"))  el("ppUsername").textContent  = newUsername ? "@" + newUsername : "";
    if (el("ppUsernameRow")) el("ppUsernameRow").textContent = newUsername ? "@" + newUsername : "—";
    if (el("ppBadgeText")) el("ppBadgeText").textContent = `Class ${cls} · ${board}`;
    if (el("ppClass"))     el("ppClass").textContent     = `Class ${cls}`;
    if (el("ppBoard"))     el("ppBoard").textContent     = board;
    const bioSection = el("ppBioSection"), bioText = el("ppBioText");
    if (bioText) { bioText.textContent = bio; if (bioSection) bioSection.style.display = bio ? "" : "none"; }
    const navTrigger = document.getElementById("profileTriggerNav");
    if (navTrigger && !navTrigger.querySelector("img")) {
      navTrigger.textContent = getInitials(name);
    } else if (navTrigger && navTrigger.querySelector("img")) {
      // Already showing photo — just keep it
    }
    const classSelect = document.getElementById("classLevel");
    const boardSelect = document.getElementById("board");
    if (classSelect) classSelect.value = cls;
    if (boardSelect) boardSelect.value = board;

    setMsg("Saved ✓", "#10b981");
    if (ppSaveBtn) { ppSaveBtn.disabled = false; ppSaveBtn.textContent = "Save Changes"; }
    setTimeout(() => setMsg(""), 2500);
  } catch (e) {
    setMsg("Save failed. Try again.");
    const ppSaveBtn = document.getElementById("ppSaveBtn");
    if (ppSaveBtn) { ppSaveBtn.disabled = false; ppSaveBtn.textContent = "Save Changes"; }
  }
}

/* ── Inline edit functionality for slider panel ── */
function initSliderInlineEdits() {
  document.querySelectorAll(".pp-inline-edit-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const field = btn.dataset.field;
      if (!field) return;
      
      // Handle bio field separately
      if (field === "bio") {
        openBioInlineEdit();
        return;
      }
      
      // Handle name field
      if (field === "name") {
        openNameInlineEdit();
        return;
      }
      
      // Handle info row fields (username, class, board)
      const row = btn.closest(".pp-info-row");
      if (!row) return;
      
      const valueEl = row.querySelector(".pp-info-value");
      if (!valueEl) return;
      
      const currentValue = valueEl.textContent.trim();
      
      // Hide current value and edit button
      valueEl.style.display = "none";
      btn.style.display = "none";
      
      let inputEl;
      if (field === "class") {
        inputEl = document.createElement("select");
        inputEl.className = "pp-inline-select";
        [8, 9, 10, 11, 12].forEach(c => {
          const opt = document.createElement("option");
          opt.value = c;
          opt.textContent = `Class ${c}`;
          if (currentValue === `Class ${c}`) opt.selected = true;
          inputEl.appendChild(opt);
        });
      } else if (field === "board") {
        inputEl = document.createElement("select");
        inputEl.className = "pp-inline-select";
        ["ICSE", "CBSE", "SSLC"].forEach(b => {
          const opt = document.createElement("option");
          opt.value = b;
          opt.textContent = b;
          if (currentValue === b) opt.selected = true;
          inputEl.appendChild(opt);
        });
      } else {
        inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.className = "pp-inline-input";
        inputEl.value = currentValue === "—" ? "" : currentValue.replace("@", "");
        if (field === "username") inputEl.placeholder = "username";
      }
      
      // Create action buttons
      const actions = document.createElement("div");
      actions.className = "pp-inline-actions";
      
      const saveBtn = document.createElement("button");
      saveBtn.className = "pp-inline-save";
      saveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
      
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "pp-inline-cancel";
      cancelBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      
      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      
      // Insert input and actions
      const rightDiv = row.querySelector(".pp-info-right");
      if (rightDiv) {
        rightDiv.insertBefore(inputEl, valueEl);
        rightDiv.appendChild(actions);
      }
      
      inputEl.focus();
      
      // For username field, add availability indicator
      let statusEl = null;
      let checkTimer = null;
      let isUsernameAvailable = true;
      
      if (field === "username") {
        statusEl = document.createElement("div");
        statusEl.className = "pp-username-status";
        // Append status below the row, not inside rightDiv
        row.parentNode.insertBefore(statusEl, row.nextSibling);
        
        // Real-time username check
        inputEl.addEventListener("input", () => {
          clearTimeout(checkTimer);
          const val = inputEl.value.trim().toLowerCase();
          
          if (!val) {
            statusEl.textContent = "";
            statusEl.className = "pp-username-status";
            isUsernameAvailable = true;
            return;
          }
          
          if (!/^[a-zA-Z0-9_.]+$/.test(val)) {
            statusEl.textContent = "Letters, numbers, _ and . only";
            statusEl.className = "pp-username-status error";
            isUsernameAvailable = false;
            return;
          }
          
          if (val.length < 3) {
            statusEl.textContent = "Min 3 characters";
            statusEl.className = "pp-username-status error";
            isUsernameAvailable = false;
            return;
          }
          
          statusEl.textContent = "Checking...";
          statusEl.className = "pp-username-status checking";
          
          checkTimer = setTimeout(async () => {
            try {
              const { data: { session } } = await supabaseClient.auth.getSession();
              if (!session) return;
              
              const { data: taken } = await supabaseClient.from("user_profiles")
                .select("id").eq("username", val).neq("id", session.user.id).limit(1);
              
              if (taken && taken.length > 0) {
                statusEl.textContent = "Username unavailable";
                statusEl.className = "pp-username-status error";
                isUsernameAvailable = false;
              } else {
                statusEl.textContent = "Available ✓";
                statusEl.className = "pp-username-status available";
                isUsernameAvailable = true;
              }
            } catch (e) {
              statusEl.textContent = "";
              isUsernameAvailable = true;
            }
          }, 400);
        });
      }
      
      const cleanup = () => {
        inputEl.remove();
        actions.remove();
        if (statusEl) statusEl.remove();
        valueEl.style.display = "";
        btn.style.display = "";
      };
      
      const save = async () => {
        let val = inputEl.value;
        if (field === "username") {
          val = val.trim().toLowerCase();
          if (!isUsernameAvailable) {
            // Don't save if username is not available
            return;
          }
        }
        const success = await saveSliderField(field, val);
        if (success) cleanup();
      };
      
      saveBtn.addEventListener("click", save);
      cancelBtn.addEventListener("click", cleanup);
      
      if (inputEl.tagName === "INPUT") {
        inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") cleanup();
        });
      }
      
      if (inputEl.tagName === "SELECT") {
        inputEl.addEventListener("change", save);
      }
    });
  });
}

/* ── Open name inline edit ── */
function openNameInlineEdit() {
  const nameWrap = document.querySelector(".pp-name-wrap");
  const nameEl = document.getElementById("ppName");
  const editBtn = nameWrap?.querySelector(".pp-inline-edit-btn");
  if (!nameWrap || !nameEl) return;
  
  const currentName = nameEl.textContent.trim();
  nameEl.style.display = "none";
  if (editBtn) editBtn.style.display = "none";
  
  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.className = "pp-inline-input pp-name-input";
  inputEl.value = currentName === "Loading…" ? "" : currentName;
  inputEl.placeholder = "Your name";
  
  const actions = document.createElement("div");
  actions.className = "pp-inline-actions";
  
  const saveBtn = document.createElement("button");
  saveBtn.className = "pp-inline-save";
  saveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
  
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "pp-inline-cancel";
  cancelBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  
  nameWrap.insertBefore(inputEl, nameEl);
  nameWrap.appendChild(actions);
  inputEl.focus();
  
  const cleanup = () => {
    inputEl.remove();
    actions.remove();
    nameEl.style.display = "";
    if (editBtn) editBtn.style.display = "";
  };
  
  const save = async () => {
    const val = inputEl.value.trim();
    const success = await saveSliderField("name", val);
    if (success) cleanup();
  };
  
  saveBtn.addEventListener("click", save);
  cancelBtn.addEventListener("click", cleanup);
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") cleanup();
  });
}

/* ── Open bio inline edit ── */
function openBioInlineEdit() {
  const bioSection = document.getElementById("ppBioSection");
  const bioText = document.getElementById("ppBioText");
  const bioEmpty = document.getElementById("ppBioEmpty");
  const bioHeader = bioSection?.querySelector(".pp-bio-header");
  const editBtn = bioHeader?.querySelector(".pp-inline-edit-btn");
  if (!bioSection) return;
  
  const currentBio = bioText?.textContent?.trim() || "";
  if (bioText) bioText.style.display = "none";
  if (bioEmpty) bioEmpty.style.display = "none";
  if (editBtn) editBtn.style.display = "none";
  
  const textarea = document.createElement("textarea");
  textarea.className = "pp-inline-textarea";
  textarea.value = currentBio;
  textarea.placeholder = "Write a short bio…";
  textarea.rows = 3;
  
  const actions = document.createElement("div");
  actions.className = "pp-inline-actions pp-bio-actions";
  
  const saveBtn = document.createElement("button");
  saveBtn.className = "pp-inline-save";
  saveBtn.textContent = "Save";
  
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "pp-inline-cancel";
  cancelBtn.textContent = "Cancel";
  
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  
  bioSection.appendChild(textarea);
  bioSection.appendChild(actions);
  textarea.focus();
  
  const cleanup = () => {
    textarea.remove();
    actions.remove();
    if (editBtn) editBtn.style.display = "";
    if (currentBio) {
      if (bioText) bioText.style.display = "";
    } else {
      if (bioEmpty) bioEmpty.style.display = "";
    }
  };
  
  const save = async () => {
    const val = textarea.value.trim();
    const success = await saveSliderField("bio", val);
    if (success) cleanup();
  };
  
  saveBtn.addEventListener("click", save);
  cancelBtn.addEventListener("click", cleanup);
}

/* ── Save a single field from slider panel ── */
async function saveSliderField(field, value) {
  if (!supabaseClient) return false;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return false;
  
  const userId = session.user.id;
  const updates = {};
  
  switch (field) {
    case "name":
      updates.full_name = value;
      break;
    case "username":
      // Validation already done in real-time, just save
      updates.username = value ? value.toLowerCase() : "";
      break;
    case "bio":
      updates.bio = value;
      break;
    case "class":
      updates.class_level = value;
      break;
    case "board":
      updates.board = value;
      break;
    default:
      return false;
  }
  
  try {
    await supabaseClient.from("user_profiles").update(updates).eq("id", userId);
    
    // Update UI elements
    const el = id => document.getElementById(id);
    
    switch (field) {
      case "name":
        if (el("ppName")) el("ppName").textContent = value || session.user.email.split("@")[0];
        if (el("ppAvatar") && !el("ppAvatar").querySelector("img")) {
          el("ppAvatar").textContent = getInitials(value || session.user.email);
        }
        const navTrigger = el("profileTriggerNav");
        if (navTrigger && !navTrigger.querySelector("img")) {
          navTrigger.textContent = getInitials(value);
        }
        if (el("editName")) el("editName").value = value;
        break;
      case "username":
        if (el("ppUsername")) el("ppUsername").textContent = value ? "@" + value : "";
        if (el("ppUsernameRow")) el("ppUsernameRow").textContent = value ? "@" + value : "—";
        if (el("editUsername")) el("editUsername").value = value;
        break;
      case "bio":
        const bioText = el("ppBioText");
        const bioEmpty = el("ppBioEmpty");
        const bioSection = el("ppBioSection");
        if (bioText) bioText.textContent = value;
        if (value) {
          if (bioText) bioText.style.display = "";
          if (bioEmpty) bioEmpty.style.display = "none";
          if (bioSection) bioSection.style.display = "";
        } else {
          if (bioText) bioText.style.display = "none";
          if (bioEmpty) bioEmpty.style.display = "";
        }
        if (el("editBio")) el("editBio").value = value;
        break;
      case "class":
        if (el("ppClass")) el("ppClass").textContent = `Class ${value}`;
        if (el("ppBadgeText")) {
          const board = el("ppBoard")?.textContent || "ICSE";
          el("ppBadgeText").textContent = `Class ${value} · ${board}`;
        }
        if (el("editClass")) el("editClass").value = value;
        const classSelect = document.getElementById("classLevel");
        if (classSelect) classSelect.value = value;
        break;
      case "board":
        if (el("ppBoard")) el("ppBoard").textContent = value;
        if (el("ppBadgeText")) {
          const cls = el("ppClass")?.textContent?.replace("Class ", "") || "10";
          el("ppBadgeText").textContent = `Class ${cls} · ${value}`;
        }
        if (el("editBoard")) el("editBoard").value = value;
        const boardSelect = document.getElementById("board");
        if (boardSelect) boardSelect.value = value;
        break;
    }
    
    return true;
  } catch (e) {
    console.error("Save failed:", e);
    return false;
  }
}

/* ── Track question + streak in one DB call (called on every send) ── */
async function trackQuestionAndStreak() {
  if (!supabaseClient) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const subject = document.getElementById("subject")?.value || null;

    // IST for consistent streak (YYYY-MM-DD)
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const { data: row } = await supabaseClient
      .from("user_profiles")
      .select("questions_count, streak, best_streak, last_active_date, last_subject")
      .eq("id", session.user.id)
      .single();

    if (!row) return;

    let newStreak = Number(row.streak) || 0;
    let newDate   = row.last_active_date || null;

    if (!newDate) {
      newStreak = 1;
      newDate = today;
    } else if (newDate === today) {
      // same day: keep streak and date
    } else if (newDate === yStr) {
      newStreak = (newStreak || 0) + 1;
      newDate = today;
    } else {
      newStreak = 0;  // skipped one or more days
      newDate = today;
    }

    const newCount = (row.questions_count || 0) + 1;

    // ── Best streak: update if current streak surpasses it ──
    const currentBest = row.best_streak || 0;
    const newBest = newStreak > currentBest ? newStreak : currentBest;

    const update = {
      questions_count:  newCount,
      streak:           newStreak,
      best_streak:      newBest,
      last_active_date: newDate,
    };
    if (subject) update.last_subject = subject;

    await supabaseClient.from("user_profiles")
      .update(update)
      .eq("id", session.user.id);

    // Update profile panel UI live
    const el = id => document.getElementById(id);
    if (el("questionsCount")) el("questionsCount").textContent = newCount;
    if (el("streakCount"))    el("streakCount").textContent    = newStreak;
    if (subject && el("ppLastSubject")) el("ppLastSubject").textContent = subject;

    // Check for new badges
    const { data: updatedProfile } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    if (updatedProfile) {
      checkAndUnlockBadges(updatedProfile);
      checkTimeBadges(); // Also check time-based badges
    }
  } catch (e) { /* silent — non-critical */ }
}

/* initPasswordToggles removed — eye toggle is handled inline per-page */

/* ── Dashboard greeting (with user name) ── */
function updateDashboardGreeting() {
  const greetingEl = document.getElementById("chatEmptyGreeting");
  if (!greetingEl) return;
  const nameEl = document.getElementById("ppName");
  const name = nameEl?.textContent?.trim() || "";
  const hour = new Date().getHours();
  let timeGreeting = "Hi";
  if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
  else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
  else if (hour >= 17 && hour < 21) timeGreeting = "Good evening";
  else timeGreeting = "Hi";
  greetingEl.textContent = name && name !== "Loading…" ? `${timeGreeting}, ${name}` : timeGreeting + " there";
}

/* ── Home page greeting (with user name) ── */
function updateHomeGreeting() {
  const greetingEl = document.getElementById("homeGreeting");
  if (!greetingEl) return;
  const nameEl = document.getElementById("ppName");
  const name = nameEl?.textContent?.trim() || "";
  const hour = new Date().getHours();
  let timeGreeting = "Hi";
  if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
  else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
  else if (hour >= 17 && hour < 21) timeGreeting = "Good evening";
  else timeGreeting = "Hi";
  greetingEl.textContent = name && name !== "Loading…" ? `${timeGreeting}, ${name}` : timeGreeting + " there";
}

/* ── Open / close ── */
function openProfilePanel() {
  document.getElementById("profilePanel")?.classList.add("open");
  document.getElementById("profileOverlay")?.classList.add("open");
  document.getElementById("menuDropdown")?.classList.remove("open");
  // Refresh time display whenever panel opens (on all pages)
  refreshTimeDisplay();
}
function closeProfilePanel() {
  document.getElementById("profilePanel")?.classList.remove("open");
  document.getElementById("profileOverlay")?.classList.remove("open");
}

/* ── Update nav Login/Logout visibility based on session ── */
async function updateNavAuthLinks() {
  const loginLink = document.getElementById("navLoginLink");
  const logoutBtn = document.getElementById("navLogoutBtn");

  let session = null;
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    session = data?.session ?? null;
  }

  if (loginLink)  loginLink.style.display  = session ? "none" : "";
  if (logoutBtn)  logoutBtn.style.display  = session ? ""     : "none";
}

/* ── Real-time username availability check on signup page ── */
function initUsernameCheck() {
  const input = document.getElementById("username");
  if (!input || !supabaseClient) return;

  let timer = null;
  let indicator = document.createElement("span");
  indicator.style.cssText = "font-size:0.72rem;margin-top:2px;display:block;min-height:16px;transition:color 0.2s;";
  input.parentNode.appendChild(indicator);

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const val = input.value.trim().toLowerCase();
    indicator.textContent = "";
    input.setCustomValidity("");

    if (!val) return;
    if (val.length < 3) {
      indicator.style.color = "#f59e0b";
      indicator.textContent = "At least 3 characters";
      return;
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(val)) {
      indicator.style.color = "#f87171";
      indicator.textContent = "Letters, numbers, _ and . only";
      input.setCustomValidity("Invalid characters");
      return;
    }

    indicator.style.color = "#9ca3af";
    indicator.textContent = "Checking…";

    timer = setTimeout(async () => {
      const { data } = await supabaseClient
        .from("user_profiles")
        .select("id")
        .eq("username", val)
        .limit(1);

      if (data && data.length > 0) {
        indicator.style.color = "#f87171";
        indicator.textContent = "✗ Username already taken";
        input.setCustomValidity("Username taken");
      } else {
        indicator.style.color = "#10b981";
        indicator.textContent = "✓ Username available";
        input.setCustomValidity("");
      }
    }, 500);
  });
}

/* ── Real-time email availability check on signup page ── */
function initEmailCheck() {
  const input = document.getElementById("email");
  if (!input || !supabaseClient) return;

  // Only run on signup page
  if (!document.getElementById("signupBtn")) return;

  let timer = null;
  let indicator = document.createElement("span");
  indicator.style.cssText = "font-size:0.72rem;margin-top:2px;display:block;min-height:16px;transition:color 0.2s;";
  input.parentNode.appendChild(indicator);

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const val = input.value.trim().toLowerCase();
    indicator.textContent = "";
    input.setCustomValidity("");

    if (!val) return;

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      indicator.style.color = "#f59e0b";
      indicator.textContent = "Enter a valid email";
      return;
    }

    indicator.style.color = "#9ca3af";
    indicator.textContent = "Checking…";

    timer = setTimeout(async () => {
      const { data } = await supabaseClient
        .from("user_profiles")
        .select("id")
        .eq("email", val)
        .limit(1);

      if (data && data.length > 0) {
        indicator.style.color = "#f87171";
        indicator.textContent = "✗ Email already registered";
        input.setCustomValidity("Email already registered");
      } else {
        indicator.style.color = "#10b981";
        indicator.textContent = "✓ Email not registered";
        input.setCustomValidity("");
      }
    }, 500);
  });
}

/* ── Wire everything on DOMContentLoaded (runs on every page) ── */
document.addEventListener("DOMContentLoaded", async () => {
  // Inject profile panel HTML into every page
  injectProfilePanel();

  // Initialize time tracking (must run before loadProfilePanel for proper timing)
  await initTimeTracking();

  // Load panel data (shows logged-out state if no session)
  await loadProfilePanel();
  
  // Initialize inline editing for slider panel
  initSliderInlineEdits();
  
  // Check time-based badges (Night Owl, Early Bird, Weekend Warrior)
  checkTimeBadges();
  
  if (isDashboard()) {
    refreshTimeDisplay();
    updateDashboardGreeting();
  }

  // Update Login/Logout nav links
  await updateNavAuthLinks();

  // Open/close bindings
  document.getElementById("profileTriggerNav")?.addEventListener("click", openProfilePanel);
  document.getElementById("profileTriggerMenu")?.addEventListener("click", openProfilePanel);
  document.getElementById("profileClose")?.addEventListener("click", closeProfilePanel);
  document.getElementById("profileOverlay")?.addEventListener("click", closeProfilePanel);
  document.getElementById("ppSaveBtn")?.addEventListener("click", saveProfileEdits);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeProfilePanel(); });

  // Real-time username availability check
  initUsernameCheck();

  // Real-time email availability check
  initEmailCheck();

  // Forgot password modal handlers
  document.getElementById("forgotPasswordLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    openForgotPasswordModal();
  });
  document.getElementById("cancelForgotBtn")?.addEventListener("click", closeForgotPasswordModal);
  document.getElementById("forgotPasswordForm")?.addEventListener("submit", forgotPassword);
  document.querySelector(".forgot-pw-overlay")?.addEventListener("click", closeForgotPasswordModal);

  // Question tracking is now done inside sendQuestion() directly

  // ── Fallback: hide page loader once DOM + panel are ready
  //    (covers pages where supabase auth check already fired, or is unavailable)
  window.__hidePageLoader?.();
});

/* ═══════════════════════════════════════════════════════════════
   CHAT HISTORY  ·  Supabase-backed sessions
═══════════════════════════════════════════════════════════════ */

/*
 * In-memory message buffer per session.
 * We build the messages array locally and flush to Supabase in one call.
 * This avoids the race-condition of fetch → append → update where two
 * rapid saves (user msg + bot msg) would each fetch an empty array and
 * overwrite each other.
 */
const _sessionMsgBuffer = {};   // { [sessionId]: [ {role,text,ts,rating?}, ... ] }

/* ── Flush buffer to Supabase without adding a new message (used for rating updates) ── */
async function _flushBufferToSupabase(sessionId) {
  if (!supabaseClient || !sessionId || !_sessionMsgBuffer[sessionId]) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    await supabaseClient
      .from("chat_sessions")
      .update({
        messages:   _sessionMsgBuffer[sessionId],
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } catch { /* silent */ }
}

/* ── Fetch all sessions for current user from Supabase ── */
async function getChatHistory() {
  if (!supabaseClient) return [];
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return [];
    const { data } = await supabaseClient
      .from("chat_sessions")
      .select("id, title, meta, messages, created_at, updated_at")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .limit(40);
    return data || [];
  } catch { return []; }
}

/* ── Create the session row in Supabase and prime the local buffer ── */
async function startHistorySession(firstQuestion, meta) {
  const id = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  _sessionMsgBuffer[id] = [];   // empty buffer for this new session

  if (!supabaseClient) return id;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return id;
    const { error: insertErr } = await supabaseClient.from("chat_sessions").insert({
      id,
      user_id:    session.user.id,
      title:      firstQuestion.slice(0, 72) + (firstQuestion.length > 72 ? "…" : ""),
      meta,
      messages:   [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insertErr) console.warn("[History] startHistorySession insert error:", insertErr.message);
  } catch (e) { console.warn("[History] startHistorySession exception:", e); }
  renderHistoryList();
  return id;
}

/* ── Add a message to the local buffer then flush the whole array to Supabase ── */
async function saveChatMessage(sessionId, role, text, replaceLastBot = false) {
  if (!sessionId) return;

  // Always update local buffer immediately (synchronous)
  if (!_sessionMsgBuffer[sessionId]) _sessionMsgBuffer[sessionId] = [];
  
  // If replaceLastBot is true, replace the last bot message instead of adding
  if (replaceLastBot && role === "bot") {
    const lastIdx = _sessionMsgBuffer[sessionId].length - 1;
    if (lastIdx >= 0 && _sessionMsgBuffer[sessionId][lastIdx].role === "bot") {
      _sessionMsgBuffer[sessionId][lastIdx] = { role, text, ts: Date.now() };
    } else {
      _sessionMsgBuffer[sessionId].push({ role, text, ts: Date.now() });
    }
  } else {
    _sessionMsgBuffer[sessionId].push({ role, text, ts: Date.now() });
  }

  // Flush the full buffer to Supabase
  if (!supabaseClient) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    // UPDATE and request the updated row back so we can verify it worked
    const { data: updated, error } = await supabaseClient
      .from("chat_sessions")
      .update({
        messages:   _sessionMsgBuffer[sessionId],
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select("id, messages");   // verify row was actually updated

    if (error) {
      console.warn("[History] saveChatMessage UPDATE error:", error.message, error.code);
    } else if (!updated || updated.length === 0) {
      // RLS blocked the update (0 rows affected, no error) — use upsert fallback
      console.warn("[History] UPDATE affected 0 rows — RLS may be blocking. Trying upsert.");
      const fallbackTitle = _sessionMsgBuffer[sessionId][0]?.text?.slice(0, 72) || "Chat";
      const { error: upsertErr } = await supabaseClient.from("chat_sessions").upsert({
        id:         sessionId,
        user_id:    session.user.id,
        title:      fallbackTitle,
        meta:       {},
        messages:   _sessionMsgBuffer[sessionId],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (upsertErr) console.warn("[History] upsert fallback error:", upsertErr.message);
      else console.log("[History] upsert fallback succeeded. Fix RLS UPDATE policy in Supabase.");
    } else {
      console.log("[History] saved OK — msgs count:", updated[0]?.messages?.length);
    }
    renderHistoryList();
  } catch (e) {
    console.warn("[History] saveChatMessage exception:", e);
  }
}

/* ── Delete one session from Supabase ── */
async function deleteHistorySession(id) {
  delete _sessionMsgBuffer[id];
  if (!supabaseClient) return;
  try {
    await supabaseClient.from("chat_sessions").delete().eq("id", id);
  } catch { /* silent */ }
  renderHistoryList();
}

/* ── Format relative time ── */
function relTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 7)  return d + "d ago";
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ── Inject the history panel into the DOM ── */
function injectHistoryPanel() {
  if (document.getElementById("historyPanel")) return;

  const html = `
  <div class="history-overlay" id="historyOverlay"></div>
  <aside class="history-panel" id="historyPanel">
    <div class="hp-header">
      <h2>Chat History</h2>
      <button class="hp-close" id="historyClose" title="Close">✕</button>
    </div>
    <div class="hp-search-wrap">
      <input class="hp-search" id="historySearch" placeholder="Search sessions…" autocomplete="off" />
    </div>
    <div class="hp-list" id="historyList"></div>
    <div class="hp-footer">
      <button class="hp-clear-all" id="historyClearAll">Clear all history</button>
    </div>
  </aside>`;

  document.body.insertAdjacentHTML("beforeend", html);

  document.getElementById("historyClose")?.addEventListener("click", closeHistoryPanel);
  document.getElementById("historyOverlay")?.addEventListener("click", closeHistoryPanel);
  document.getElementById("historyClearAll")?.addEventListener("click", async () => {
    if (confirm("Delete all chat history? This cannot be undone.")) {
      if (supabaseClient) {
        try {
          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session) {
            await supabaseClient.from("chat_sessions").delete().eq("user_id", session.user.id);
          }
        } catch { /* silent */ }
      }
      renderHistoryList();
    }
  });
  document.getElementById("historySearch")?.addEventListener("input", (e) => {
    renderHistoryList(e.target.value.trim().toLowerCase());
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeHistoryPanel();
  });

  // Close dropdown menus when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".hp-item-menu-wrap")) {
      document.querySelectorAll(".hp-item-dropdown.open").forEach(d => d.classList.remove("open"));
    }
  });

  renderHistoryList();
}

function openHistoryPanel() {
  // Show panel immediately — render list async
  document.getElementById("historyPanel")?.classList.add("open");
  document.getElementById("historyOverlay")?.classList.add("open");
  document.getElementById("menuDropdown")?.classList.remove("open");
  // Show loading skeleton while Supabase fetches
  const list = document.getElementById("historyList");
  if (list && !list.children.length) {
    list.innerHTML = `<div class="hp-loading">
      <div class="hp-skeleton"></div><div class="hp-skeleton hp-skeleton-sm"></div>
      <div class="hp-skeleton"></div><div class="hp-skeleton hp-skeleton-sm"></div>
      <div class="hp-skeleton"></div>
    </div>`;
  }
  renderHistoryList();
}
function closeHistoryPanel() {
  document.getElementById("historyPanel")?.classList.remove("open");
  document.getElementById("historyOverlay")?.classList.remove("open");
}

/* ── Render the list of sessions ── */
async function renderHistoryList(query = "") {
  const list = document.getElementById("historyList");
  if (!list) return;

  let sessions = await getChatHistory();
  if (query) {
    sessions = sessions.filter(s =>
      s.title.toLowerCase().includes(query) ||
      s.meta?.subject?.toLowerCase().includes(query)
    );
  }

  if (!sessions.length) {
    list.innerHTML = `<div class="hp-empty">
      <div class="hp-empty-icon">💬</div>
      <div class="hp-empty-text">${query ? "No sessions match." : "No history yet.<br>Start chatting to save sessions."}</div>
    </div>`;
    return;
  }

  // Sort by updated_at (most recent first) - already sorted from DB but ensure it
  sessions.sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : (a.updatedAt || 0);
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : (b.updatedAt || 0);
    return bTime - aTime;
  });

  list.innerHTML = "";

  sessions.forEach(s => {
    const item = document.createElement("div");
    item.className = "hp-item";
    item.dataset.sessionId = s.id;

    const msgs     = Array.isArray(s.messages) ? s.messages : [];
    const msgCount = msgs.length;
    const preview  = msgs.find(m => m.role === "bot")?.text?.slice(0, 60) || "";
    const metaObj  = s.meta || {};
    const updatedMs = s.updated_at ? new Date(s.updated_at).getTime() : (s.updatedAt || Date.now());
    const createdMs = s.created_at ? new Date(s.created_at).getTime() : (s.createdAt || Date.now());
    
    // Format created date nicely
    const createdDate = new Date(createdMs);
    const createdStr = createdDate.toLocaleDateString("en-IN", { 
      day: "numeric", 
      month: "short", 
      year: "numeric" 
    });

    // Highlight the currently loaded session
    if (window._activeHistorySessionId === s.id) item.classList.add("active");

    const mainDiv = document.createElement("div");
    mainDiv.className = "hp-item-main";
    mainDiv.innerHTML = `
      <div class="hp-item-title">${escapeHtml(s.title)}</div>
      ${preview ? `<div class="hp-item-preview">${escapeHtml(preview)}…</div>` : ""}
      <div class="hp-item-meta">
        <span>${metaObj.subject || "General"}</span>
        <span>·</span>
        <span>${msgCount} msg${msgCount !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>${relTime(updatedMs)}</span>
      </div>`;
    // Direct listener — no delegation, no { once }
    mainDiv.addEventListener("click", () => {
      loadHistorySession(s.id);
      closeHistoryPanel();
    });

    // ── Three-dot menu ──
    const menuWrap = document.createElement("div");
    menuWrap.className = "hp-item-menu-wrap";

    const menuBtn = document.createElement("button");
    menuBtn.className = "hp-item-menu-btn";
    menuBtn.title = "Options";
    menuBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;

    const dropdown = document.createElement("div");
    dropdown.className = "hp-item-dropdown";

    // Created date info
    const dateInfo = document.createElement("div");
    dateInfo.className = "hp-dropdown-date";
    dateInfo.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Created ${createdStr}`;

    const divider = document.createElement("div");
    divider.className = "hp-dropdown-divider";

    const deleteOption = document.createElement("button");
    deleteOption.className = "hp-delete-option";
    deleteOption.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete conversation`;

    deleteOption.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.remove("open");
      // Optimistic UI — remove item immediately, then delete from DB
      item.style.transition = "opacity 0.2s, transform 0.2s";
      item.style.opacity = "0";
      item.style.transform = "translateX(12px)";
      setTimeout(() => { item.remove(); }, 200);
      deleteHistorySession(s.id);
    });

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close any other open dropdowns first
      document.querySelectorAll(".hp-item-dropdown.open").forEach(d => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });

    dropdown.appendChild(dateInfo);
    dropdown.appendChild(divider);
    dropdown.appendChild(deleteOption);
    menuWrap.appendChild(menuBtn);
    menuWrap.appendChild(dropdown);

    item.appendChild(mainDiv);
    item.appendChild(menuWrap);
    list.appendChild(item);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ── Restore a past session into the chat window ── */
async function loadHistorySession(id) {
  const chatWindow = document.getElementById("chatWindow");
  if (!chatWindow) return;

  let s = null;
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from("chat_sessions").select("*").eq("id", id).single();
      s = data;
    } catch { /* silent */ }
  }
  if (!s) return;
  const msgs = Array.isArray(s.messages) ? s.messages : [];
  // Log so you can see what's saved (remove after debugging)
  console.log("[History] Loading session:", id, "messages:", JSON.stringify(msgs));
  if (!msgs.length) {
    // Nothing saved yet — just show empty chat with meta restored
  }

  // Clear current chat
  chatWindow.innerHTML = "";
  document.getElementById("chatEmptyState")?.remove();

  // Restore meta selectors
  const metaObj = s.meta || {};
  const classEl   = document.getElementById("classLevel");
  const boardEl   = document.getElementById("board");
  const subjectEl = document.getElementById("subject");
  if (classEl   && metaObj.class_level) classEl.value   = metaObj.class_level;
  if (boardEl   && metaObj.board)       boardEl.value   = metaObj.board;
  if (subjectEl && metaObj.subject)     subjectEl.value = metaObj.subject;

  // Re-render messages — identical to how the live chat renders them
  msgs.forEach((msg, idx) => {
    const row = document.createElement("div");
    row.className = "message-row " + msg.role;
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    const msgContent = document.createElement("div");

    if (msg.role === "user") {
      // User messages: preserve newlines
      msgContent.style.whiteSpace = "pre-wrap";
      msgContent.textContent = msg.text;
    } else {
      // Bot messages: msg.text is the raw response — format it exactly like the live stream
      msgContent.innerHTML = formatGeminiResponse(msg.text);
    }

    bubble.appendChild(msgContent);
    row.appendChild(bubble);
    chatWindow.appendChild(row);

    // Add action bar to bot messages (copy, thumbs, regenerate) — restore rating state
    if (msg.role === "bot") {
      const prevMsg = msgs[idx - 1];
      const userQuestion = prevMsg?.role === "user" ? prevMsg.text : "";
      const savedRating  = msg.rating || 0;   // restore thumbs state
      addMessageActions(row, msgContent, userQuestion, () => {
        const qi = document.getElementById("questionInput");
        if (qi && userQuestion) {
          qi.value = userQuestion;
          qi.dispatchEvent(new Event("input"));
        }
      }, savedRating);
    }
  });

  // Show restored banner
  const banner = document.createElement("div");
  banner.className = "hp-restored-banner";
  banner.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.36"/></svg> Restored from history`;
  chatWindow.prepend(banner);

  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Mark the active session so new messages append to it
  window._activeHistorySessionId = id;

  // Prime the in-memory buffer from the loaded messages
  // so if the user continues this conversation, new messages append correctly
  _sessionMsgBuffer[id] = [...msgs];

  // Scroll the page back to top so the chat window is visible
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Focus the input so the user can continue the conversation
  const qi = document.getElementById("questionInput");
  if (qi) setTimeout(() => qi.focus(), 300);
}
