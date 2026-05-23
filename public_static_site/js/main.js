document.addEventListener("DOMContentLoaded", () => {
  // ─── LANGUAGE SWITCHER ───
  let currentLocale = localStorage.getItem("cridora_locale") || "en";
  applyLocale(currentLocale);

  const switchEn = document.getElementById("lang-en");
  const switchMl = document.getElementById("lang-ml");
  
  if (switchEn && switchMl) {
    updateSwitchButtons();
    switchEn.addEventListener("click", () => {
      currentLocale = "en";
      localStorage.setItem("cridora_locale", "en");
      applyLocale("en");
      updateSwitchButtons();
    });
    switchMl.addEventListener("click", () => {
      currentLocale = "ml";
      localStorage.setItem("cridora_locale", "ml");
      applyLocale("ml");
      updateSwitchButtons();
    });
  }

  function updateSwitchButtons() {
    if (currentLocale === "en") {
      switchEn.classList.add("public-lang-switch__btn--active");
      switchMl.classList.remove("public-lang-switch__btn--active");
    } else {
      switchMl.classList.add("public-lang-switch__btn--active");
      switchEn.classList.remove("public-lang-switch__btn--active");
    }
  }

  function applyLocale(locale) {
    document.documentElement.lang = locale;
    if (locale === "ml") {
      document.body.classList.add("ml-locale");
    } else {
      document.body.classList.remove("ml-locale");
    }

    const dict = window.translations ? window.translations[locale] : null;
    if (!dict) return;

    // Apply translations to all tags with data-i18n
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach(el => {
      const key = el.getAttribute("data-i18n");
      let text = dict[key] || window.translations["en"][key] || key;
      
      // Handle variables if present
      if (el.hasAttribute("data-i18n-vars")) {
        try {
          const vars = JSON.parse(el.getAttribute("data-i18n-vars"));
          Object.keys(vars).forEach(vk => {
            text = text.replace(`{${vk}}`, vars[vk]);
          });
        } catch(e) {}
      }

      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = text;
      } else {
        el.textContent = text;
      }
    });
  }

  // ─── NAV NAVIGATION HIGHLIGHTS ───
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    if (href === currentPath || (currentPath === "index.html" && href === "./") || (currentPath === "" && href === "index.html")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // ─── DYNAMIC HERO PARTICLES ───
  const particlesContainer = document.getElementById("hero-particles");
  if (particlesContainer) {
    const keyframes = [
      "home-hero-particle-1",
      "home-hero-particle-2",
      "home-hero-particle-3",
      "home-hero-particle-4"
    ];
    const seeds = [
      { t: 8, l: 6, d: 0, dur: 22, a: 0 },
      { t: 18, l: 22, d: 1, dur: 26, a: 1 },
      { t: 5, l: 48, d: 2, dur: 20, a: 2 },
      { t: 32, l: 72, d: 0.5, dur: 28, a: 3 },
      { t: 44, l: 12, d: 3, dur: 24, a: 0 },
      { t: 12, l: 88, d: 1.5, dur: 21, a: 1 },
      { t: 58, l: 38, d: 2.5, dur: 19, a: 2 },
      { t: 70, l: 58, d: 0, dur: 25, a: 3 },
      { t: 26, l: 66, d: 4, dur: 23, a: 0 },
      { t: 82, l: 28, d: 1, dur: 20, a: 1 },
      { t: 14, l: 42, d: 5, dur: 27, a: 2 },
      { t: 62, l: 8, d: 2, dur: 18, a: 3 },
      { t: 36, l: 92, d: 0.2, dur: 24, a: 0 },
      { t: 52, l: 50, d: 3.5, dur: 22, a: 1 },
      { t: 76, l: 18, d: 1, dur: 21, a: 2 },
      { t: 4, l: 34, d: 6, dur: 26, a: 3 },
      { t: 90, l: 78, d: 0, dur: 20, a: 0 },
      { t: 22, l: 14, d: 4, dur: 25, a: 1 },
      { t: 48, l: 84, d: 1.2, dur: 19, a: 2 }
    ];

    seeds.forEach(s => {
      const dot = document.createElement("span");
      dot.className = "home-hero-art__dot";
      dot.style.top = `${s.t}%`;
      dot.style.left = `${s.l}%`;
      dot.style.animation = `${keyframes[s.a % 4]} ${s.dur}s ease-in-out ${s.d}s infinite`;
      particlesContainer.appendChild(dot);
    });
  }

  // ─── LIVE GOLD TICKER SIMULATOR ───
  let base22k = 6842.50;
  let base24k = 7468.20;

  const rate22kVal = document.getElementById("rate-22k-val");
  const rate24kVal = document.getElementById("rate-24k-val");
  const tickerTime = document.getElementById("ticker-time");

  function updateTicker() {
    // Generate slight random variations
    const delta22k = (Math.random() - 0.5) * 4;
    const delta24k = delta22k / 0.916; // proportional change

    base22k = Math.max(6500, Math.min(7200, base22k + delta22k));
    base24k = Math.max(7100, Math.min(7900, base24k + delta24k));

    if (rate22kVal && rate24kVal) {
      // Add animation flash classes
      const trendClass = delta22k >= 0 ? "trend-up" : "trend-down";
      
      rate22kVal.className = `tabular ${trendClass}`;
      rate24kVal.className = `tabular ${trendClass}`;

      rate22kVal.textContent = "₹" + base22k.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      rate24kVal.textContent = "₹" + base24k.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      // Clear flash after 800ms
      setTimeout(() => {
        rate22kVal.classList.remove("trend-up", "trend-down");
        rate24kVal.classList.remove("trend-up", "trend-down");
      }, 800);
    }
  }

  // Initial update
  updateTicker();
  // Poll every 10s
  setInterval(updateTicker, 10000);

  // Update ticker interval display text
  if (tickerTime) {
    tickerTime.setAttribute("data-i18n-vars", JSON.stringify({ interval: "10.0s" }));
  }

  // ─── FORM HANDLING (MOCK) ───
  const applyForm = document.getElementById("jeweller-apply-form");
  if (applyForm) {
    applyForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const feedback = applyForm.querySelector(".form-feedback") || document.createElement("div");
      feedback.className = "form-feedback form-feedback--success";
      feedback.style.marginTop = "1rem";
      feedback.textContent = currentLocale === "ml" 
        ? "അപേക്ഷ വിജയകരമായി സമർപ്പിച്ചു! ഞങ്ങളുടെ പ്രതിനിധി ഉടൻ ബന്ധപ്പെടും." 
        : "Application submitted successfully! Our representative will contact you soon.";
      applyForm.appendChild(feedback);
      applyForm.reset();
    });
  }

  const waitlistFormUser = document.getElementById("waitlist-form-user");
  if (waitlistFormUser) {
    waitlistFormUser.addEventListener("submit", (e) => {
      e.preventDefault();
      const feedback = document.createElement("div");
      feedback.className = "form-feedback form-feedback--success";
      feedback.style.marginTop = "0.75rem";
      feedback.textContent = currentLocale === "ml" 
        ? "അഭിനന്ദനങ്ങൾ! നിങ്ങൾ വെയ്റ്റ്‌ലിസ്റ്റിൽ വിജയകരമായി ചേർന്നു." 
        : "Congratulations! You have successfully joined the customer waitlist.";
      waitlistFormUser.appendChild(feedback);
      waitlistFormUser.reset();
    });
  }
});
