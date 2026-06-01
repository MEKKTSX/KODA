/** KODA UI v2 — shared Tailwind theme with dynamic Dark/White theme support via CSS Variables */

// 1. IIFE to inject the CSS Variables and initialize the theme class immediately
(function() {
  const style = document.createElement('style');
  style.id = 'koda-theme-variables';
  style.innerHTML = `
    :root {
      --koda-bg: #f8fafc;
      --koda-surface: #ffffff;
      --koda-surface-muted: #f1f5f9;
      --koda-border: #e2e8f0;
      --koda-border-strong: #cbd5e1;
      --koda-primary: #2563eb;
      --koda-primary-hover: #1d4ed8;
      --koda-primary-muted: #dbeafe;
      --koda-success: #059669;
      --koda-danger: #dc2626;
      --koda-text: #0f172a;
      --koda-text-muted: #64748b;
      --koda-text-subtle: #94a3b8;
      
      --koda-background-dark: #f8fafc;
      --koda-surface-dark: #ffffff;
      --koda-border-dark: #e2e8f0;
      
      --koda-white-text: #0f172a;
      --koda-slate-50: #f8fafc;
      --koda-slate-100: #1e293b;
      --koda-slate-200: #cbd5e1;
      --koda-slate-300: #475569;
      --koda-slate-400: #64748b;
      --koda-slate-500: #64748b;
      --koda-slate-600: #475569;
      --koda-slate-700: #334155;
      --koda-slate-800: #1e293b;
      --koda-slate-900: #0f172a;

      --koda-header-bg: rgba(248, 250, 252, 0.92);
      --koda-nav-bg: rgba(255, 255, 255, 0.95);
    }
    
    html.dark, body.dark, .dark {
      --koda-bg: #0b0f19;
      --koda-surface: #131b2e;
      --koda-surface-muted: #1e293b;
      --koda-border: #1e293b;
      --koda-border-strong: #334155;
      --koda-text: #f8fafc;
      --koda-text-muted: #94a3b8;
      --koda-text-subtle: #64748b;
      
      --koda-background-dark: #0b0f19;
      --koda-surface-dark: #131b2e;
      --koda-border-dark: #1e293b;
      
      --koda-white-text: #ffffff;
      --koda-slate-50: #0f172a;
      --koda-slate-100: #f1f5f9;
      --koda-slate-200: #cbd5e1;
      --koda-slate-300: #cbd5e1;
      --koda-slate-400: #94a3b8;
      --koda-slate-500: #94a3b8;
      --koda-slate-600: #cbd5e1;
      --koda-slate-700: #e2e8f0;
      --koda-slate-800: #1e293b;
      --koda-slate-900: #f8fafc;

      --koda-header-bg: rgba(19, 27, 46, 0.92);
      --koda-nav-bg: rgba(19, 27, 46, 0.95);
    }

    /* Force clean white text on dark/colored background components regardless of mode */
    .bg-primary, .bg-danger, .bg-success, .bg-emerald-500, .bg-rose-500, .bg-blue-600, .bg-indigo-600, .bg-yellow-500, .bg-gradient-to-r, .bg-gradient-to-tr {
      color: #ffffff !important;
    }
    .bg-primary *, .bg-danger *, .bg-success *, .bg-emerald-500 *, .bg-rose-500 *, .bg-blue-600 *, .bg-indigo-600 *, .bg-yellow-500 *, .bg-gradient-to-r *, .bg-gradient-to-tr * {
      color: #ffffff !important;
    }
  `;
  document.head.appendChild(style);

  // Initialize DOM classes based on saved theme preference
  const isDark = localStorage.getItem('koda_dark_mode') === 'true';
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();

// 2. Shared Tailwind Configuration mapping colors to theme CSS variables
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        success: "#059669",
        danger: "#DC2626",
        white: "var(--koda-white-text)",
        "background-light": "var(--koda-bg)",
        "background-dark": "var(--koda-background-dark)",
        "surface-dark": "var(--koda-surface-dark)",
        "border-dark": "var(--koda-border-dark)",
        slate: {
          50: "var(--koda-slate-50)",
          100: "var(--koda-slate-100)",
          200: "var(--koda-slate-200)",
          300: "var(--koda-slate-300)",
          400: "var(--koda-slate-400)",
          500: "var(--koda-slate-500)",
          600: "var(--koda-slate-600)",
          700: "var(--koda-slate-700)",
          800: "var(--koda-slate-800)",
          900: "var(--koda-slate-900)",
        }
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
      },
    },
  },
};

// 3. Robust, Silent Cloud Auto-Backup via dynamic Supabase loading
(function() {
  let backupTimeout = null;

  window.triggerKodaAutoBackup = function() {
    if (backupTimeout) clearTimeout(backupTimeout);
    backupTimeout = setTimeout(async () => {
      try {
        if (!window.supabase) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        if (typeof window.loadKodaConfig !== 'function') return;
        await window.loadKodaConfig();
        
        const keys = window.ENV_KEYS || {};
        if (!keys.SUPABASE_URL || !keys.SUPABASE_ANON_KEY) return;

        const supabase = window.supabase.createClient(keys.SUPABASE_URL, keys.SUPABASE_ANON_KEY);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const portData = localStorage.getItem('koda_portfolio_data') || '{}';
        const equityData = localStorage.getItem('koda_equity_history') || '[]';

        await supabase
          .from('user_backups')
          .upsert({
            id: user.id,
            portfolio_data: JSON.parse(portData),
            equity_history: JSON.parse(equityData),
            updated_at: new Date().toISOString()
          });

        console.log("[KODA Auto-Backup] Silent cloud backup sync complete!");
      } catch (e) {
        console.error("[KODA Auto-Backup] Silent backup failed:", e);
      }
    }, 3000); // 3-second debounce to protect database performance
  };

  // Intercept all localStorage updates to trigger auto-backup when portfolio or watchlist data changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (key === 'koda_portfolio_data' || key === 'koda_equity_history') {
      window.triggerKodaAutoBackup();
    }
  };
})();
