// TAGFREEFIREMAX Client Scripts

document.addEventListener('DOMContentLoaded', () => {
  // Purge any legacy client-side background overrides so official admin background is always shown
  try {
    localStorage.removeItem('tagff_custom_bg');
  } catch (e) {}

  // 0. Auto-sync admin token to cookies and admin links (prevents multiple password prompts in iframes)
  const savedToken = localStorage.getItem('tag_admin_token');
  if (savedToken) {
    if (!document.cookie.includes('tag_admin_token=')) {
      document.cookie = `tag_admin_token=${savedToken}; path=/; max-age=2592000; SameSite=Lax`;
    }
    // Append token to admin links seamlessly
    document.querySelectorAll('a[href^="/admin"]').forEach(a => {
      const href = a.getAttribute('href');
      if (href && !href.includes('auth_token=') && !href.includes('/admin/logout')) {
        const separator = href.includes('?') ? '&' : '?';
        a.setAttribute('href', `${href}${separator}auth_token=${savedToken}`);
      }
    });
  }

  // 0. TOP OF EVERYTHING - Global Mode Selector (Official vs Unofficial vs All)
  const modeButtons = document.querySelectorAll('.global-mode-btn');
  const serverStatsScript = document.getElementById('server-stats-data');
  let serverStats = { currentTourneySummary: null, careerSummary: null, currentTournament: null };
  
  if (serverStatsScript) {
    try {
      serverStats = JSON.parse(serverStatsScript.textContent || '{}');
    } catch (e) {
      console.warn('Could not parse server stats JSON', e);
    }
  }

  function applyGlobalMode(mode) {
    // 1. Update button visual states
    modeButtons.forEach(btn => {
      const btnMode = btn.getAttribute('data-mode');
      const dot = btn.querySelector('span');
      if (btnMode === mode) {
        if (mode === 'official') {
          btn.className = 'global-mode-btn touch-manipulation select-none py-2 px-3.5 rounded-lg font-mono text-xs font-bold flex items-center justify-center sm:justify-start gap-2 transition-all duration-300 cursor-pointer active:scale-95 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950/40';
          if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 shrink-0';
        } else if (mode === 'unofficial') {
          btn.className = 'global-mode-btn touch-manipulation select-none py-2 px-3.5 rounded-lg font-mono text-xs font-bold flex items-center justify-center sm:justify-start gap-2 transition-all duration-300 cursor-pointer active:scale-95 bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-950/40';
          if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400 shrink-0';
        } else {
          btn.className = 'global-mode-btn touch-manipulation select-none py-2 px-3.5 rounded-lg font-mono text-xs font-bold flex items-center justify-center sm:justify-start gap-2 transition-all duration-300 cursor-pointer active:scale-95 bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/40 shadow-lg shadow-red-950/40';
          if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-[#ff4e00] shadow-sm shadow-orange-400 shrink-0';
        }
      } else {
        btn.className = 'global-mode-btn touch-manipulation select-none py-2 px-3.5 rounded-lg font-mono text-xs font-bold flex items-center justify-center sm:justify-start gap-2 transition-all duration-300 cursor-pointer active:scale-95 bg-black/30 text-gray-400 hover:text-gray-200 border border-transparent';
        if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-gray-600 shrink-0';
      }
    });

    // 2. Active Mode Indicator
    const activeIndicator = document.getElementById('active-mode-indicator');
    if (activeIndicator) {
      if (mode === 'official') {
        activeIndicator.className = 'badge-official text-[10px] py-0.5';
        activeIndicator.textContent = 'OFFICIAL MODE';
      } else if (mode === 'unofficial') {
        activeIndicator.className = 'badge-unofficial text-[10px] py-0.5';
        activeIndicator.textContent = 'UNOFFICIAL (LOCAL ORGANIZER)';
      } else {
        activeIndicator.className = 'px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/30';
        activeIndicator.textContent = 'ALL DATA (COMBINED)';
      }
    }

    // 3. Update Hero Badge & Title
    const heroTypeBadge = document.getElementById('hero-type-badge');
    const statCardTitle = document.getElementById('stat-card-title');
    const heroContextBox = document.getElementById('hero-context-box');
    const heroContextText = document.getElementById('hero-context-text');

    if (heroTypeBadge) {
      if (mode === 'official') {
        heroTypeBadge.className = 'badge-official';
        heroTypeBadge.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> OFFICIAL CIRCUIT`;
      } else if (mode === 'unofficial') {
        heroTypeBadge.className = 'badge-unofficial';
        heroTypeBadge.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> LOCAL ORGANIZER`;
      } else {
        heroTypeBadge.className = 'px-2.5 py-0.5 rounded-md text-xs font-mono bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/30 font-bold';
        heroTypeBadge.innerHTML = `ALL TOURNAMENTS`;
      }
    }

    if (statCardTitle) {
      if (mode === 'official') {
        statCardTitle.textContent = 'Official Tournament Stats';
      } else if (mode === 'unofficial') {
        statCardTitle.textContent = 'Local Organizer Tournament Stats';
      } else {
        statCardTitle.textContent = 'Combined Live Stats';
      }
    }

    if (heroContextBox && heroContextText) {
      if (mode === 'official') {
        heroContextBox.className = 'p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-start gap-2 transition-all';
        heroContextText.textContent = 'Showing official tournament data. All kills, Booyahs, matches, and K/D are verified esports records.';
      } else if (mode === 'unofficial') {
        heroContextBox.className = 'p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2 transition-all';
        heroContextText.textContent = 'Showing unofficial tournaments organized by local tournament organizers. Includes local cups & community scrims.';
      } else {
        heroContextBox.className = 'p-2.5 rounded-lg bg-[#ff4e00]/10 border border-[#ff4e00]/25 text-[#ff4e00] text-xs flex items-start gap-2 transition-all';
        heroContextText.textContent = 'Showing all tournament data combined. Live add-up total of official esports and local organizer tournaments.';
      }
    }

    // 4. Update the 4 Core Metrics (TOTAL MATCHES, TOTAL KILLS, TOTAL BOOYAH, TOTAL KD)
    const statMatches = document.getElementById('hero-stat-matches');
    const statMatchesSub = document.getElementById('hero-stat-matches-sub');
    const statKills = document.getElementById('hero-stat-kills');
    const statKillsSub = document.getElementById('hero-stat-kills-sub');
    const statBooyahs = document.getElementById('hero-stat-booyahs');
    const statBooyahsSub = document.getElementById('hero-stat-booyahs-sub');
    const statKd = document.getElementById('hero-stat-kd');

    const summary = serverStats.currentTourneySummary || serverStats.careerSummary || {
      official: { matches: 0, kills: 0, booyahs: 0, points: 0, kd: '0.00', avg_kills: '0.0', win_rate: '0.0' },
      unofficial: { matches: 0, kills: 0, booyahs: 0, points: 0, kd: '0.00', avg_kills: '0.0', win_rate: '0.0' },
      combined: { matches: 0, kills: 0, booyahs: 0, points: 0, kd: '0.00', avg_kills: '0.0', win_rate: '0.0' }
    };
    const targetStats = mode === 'official' ? summary.official : (mode === 'unofficial' ? summary.unofficial : summary.combined);

    if (statMatches) {
      statMatches.textContent = targetStats.matches ?? 0;
    }
    if (statMatchesSub) {
      statMatchesSub.textContent = mode === 'official' ? 'Official Matches' : (mode === 'unofficial' ? 'Local Organizer Matches' : 'Total Combined Matches');
      statMatchesSub.className = mode === 'official' ? 'text-[10px] text-emerald-400 font-mono mt-1' : (mode === 'unofficial' ? 'text-[10px] text-amber-400 font-mono mt-1' : 'text-[10px] text-[#ff4e00] font-mono mt-1');
    }

    if (statKills) {
      statKills.textContent = targetStats.kills ?? 0;
    }
    if (statKillsSub) {
      statKillsSub.textContent = `${targetStats.avg_kills ?? '0.0'}/match`;
    }

    if (statBooyahs) {
      statBooyahs.textContent = targetStats.booyahs ?? 0;
    }
    if (statBooyahsSub) {
      statBooyahsSub.textContent = `${targetStats.win_rate ?? '0.0'}% Win Rate`;
    }

    if (statKd) {
      statKd.textContent = targetStats.kd ?? '0.00';
    }

    const statPoints = document.getElementById('hero-stat-points');
    if (statPoints && targetStats.points !== undefined) {
      statPoints.textContent = `${targetStats.points} PTS`;
    }

    // 5. Filter Match Cards Feed
    const matchCards = document.querySelectorAll('.match-card');
    let visibleMatchCount = 0;

    matchCards.forEach(card => {
      const isOfficial = card.getAttribute('data-is-official') === 'true';
      let shouldShow = false;

      if (mode === 'official') {
        shouldShow = isOfficial;
      } else if (mode === 'unofficial') {
        shouldShow = !isOfficial;
      } else {
        shouldShow = true;
      }

      if (shouldShow) {
        card.classList.remove('hidden');
        visibleMatchCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    const noMatchesMsg = document.getElementById('no-matches-message');
    if (noMatchesMsg) {
      if (visibleMatchCount === 0) {
        noMatchesMsg.classList.remove('hidden');
      } else {
        noMatchesMsg.classList.add('hidden');
      }
    }

    const matchCountBadge = document.getElementById('match-count-badge');
    if (matchCountBadge) {
      matchCountBadge.textContent = `${visibleMatchCount} Matches`;
    }

    const matchFilterIndicator = document.getElementById('match-filter-indicator');
    if (matchFilterIndicator) {
      if (mode === 'official') {
        matchFilterIndicator.className = 'badge-official text-[10px]';
        matchFilterIndicator.textContent = 'OFFICIAL MATCHES';
      } else if (mode === 'unofficial') {
        matchFilterIndicator.className = 'badge-unofficial text-[10px]';
        matchFilterIndicator.textContent = 'LOCAL ORGANIZER MATCHES';
      } else {
        matchFilterIndicator.className = 'px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/30';
        matchFilterIndicator.textContent = 'ALL MATCHES';
      }
    }

    // 6. Update and Re-Sort Top Fraggers
    const topPlayerBadge = document.getElementById('top-players-badge');
    if (topPlayerBadge) {
      if (mode === 'official') {
        topPlayerBadge.className = 'badge-official text-[10px]';
        topPlayerBadge.textContent = 'OFFICIAL';
      } else if (mode === 'unofficial') {
        topPlayerBadge.className = 'badge-unofficial text-[10px]';
        topPlayerBadge.textContent = 'LOCAL ORGANIZER';
      } else {
        topPlayerBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/30';
        topPlayerBadge.textContent = 'COMBINED';
      }
    }

    const topPlayerRows = Array.from(document.querySelectorAll('.top-player-row'));
    if (topPlayerRows.length > 0) {
      topPlayerRows.forEach(row => {
        const killsKey = mode === 'official' ? 'data-official-kills' : (mode === 'unofficial' ? 'data-unofficial-kills' : 'data-combined-kills');
        const matchesKey = mode === 'official' ? 'data-official-matches' : (mode === 'unofficial' ? 'data-unofficial-matches' : 'data-combined-matches');
        
        const kills = Number(row.getAttribute(killsKey)) || 0;
        const matches = Number(row.getAttribute(matchesKey)) || 0;

        const killsValEl = row.querySelector('.player-kills-val');
        const matchesValEl = row.querySelector('.player-matches-val');

        if (killsValEl) killsValEl.textContent = `${kills} Kills`;
        if (matchesValEl) matchesValEl.textContent = `${matches} Matches`;
        row.setAttribute('data-active-kills', String(kills));
      });

      // Sort rows by active kills descending
      const container = document.getElementById('top-players-container');
      if (container) {
        topPlayerRows.sort((a, b) => {
          const kA = Number(a.getAttribute('data-active-kills')) || 0;
          const kB = Number(b.getAttribute('data-active-kills')) || 0;
          return kB - kA;
        });

        topPlayerRows.forEach((row, idx) => {
          const rankEl = row.querySelector('.player-rank-num');
          if (rankEl) {
            rankEl.textContent = `#${idx + 1}`;
            rankEl.className = `player-rank-num font-display text-xl font-bold ${idx === 0 ? 'text-amber-400' : 'text-gray-600'}`;
          }
          container.insertBefore(row, container.querySelector('.pt-2'));
        });
      }
    }

    // 7. Update Map Analysis Cards in Real Time
    const mapAnalysisBadge = document.getElementById('map-analysis-filter-badge');
    if (mapAnalysisBadge) {
      if (mode === 'official') {
        mapAnalysisBadge.className = 'badge-official text-[10px]';
        mapAnalysisBadge.textContent = 'OFFICIAL STATS';
      } else if (mode === 'unofficial') {
        mapAnalysisBadge.className = 'badge-unofficial text-[10px]';
        mapAnalysisBadge.textContent = 'LOCAL ORGANIZER';
      } else {
        mapAnalysisBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/30';
        mapAnalysisBadge.textContent = 'ALL COMBINED';
      }
    }

    const mapCards = document.querySelectorAll('.map-analysis-card');
    mapCards.forEach(card => {
      const isOfficial = mode === 'official';
      const matchesKey = isOfficial ? 'data-official-matches' : 'data-combined-matches';
      const killsKey = isOfficial ? 'data-official-kills' : 'data-combined-kills';
      const kdKey = isOfficial ? 'data-official-kd' : 'data-combined-kd';
      const booyahsKey = isOfficial ? 'data-official-booyahs' : 'data-combined-booyahs';
      const winrateKey = isOfficial ? 'data-official-winrate' : 'data-combined-winrate';
      const avgkillsKey = isOfficial ? 'data-official-avgkills' : 'data-combined-avgkills';

      const matches = card.getAttribute(matchesKey) || '0';
      const kills = card.getAttribute(killsKey) || '0';
      const kd = card.getAttribute(kdKey) || '0.00';
      const booyahs = card.getAttribute(booyahsKey) || '0';
      const winrate = card.getAttribute(winrateKey) || '0.0';
      const avgkills = card.getAttribute(avgkillsKey) || '0.0';

      const matchesLabel = card.querySelector('.map-matches-label');
      const matchesVal = card.querySelector('.map-matches-val');
      const killsVal = card.querySelector('.map-kills-val');
      const kdVal = card.querySelector('.map-kd-val');
      const booyahsVal = card.querySelector('.map-booyahs-val');
      const winrateVal = card.querySelector('.map-winrate-val');
      const avgkillsVal = card.querySelector('.map-avgkills-val');

      if (matchesLabel) matchesLabel.textContent = matches;
      if (matchesVal) matchesVal.textContent = matches;
      if (killsVal) killsVal.textContent = kills;
      if (kdVal) kdVal.textContent = kd;
      if (booyahsVal) booyahsVal.textContent = booyahs;
      if (winrateVal) winrateVal.textContent = winrate;
      if (avgkillsVal) avgkillsVal.textContent = avgkills;
    });

    // Save selection to localStorage
    try {
      localStorage.setItem('tag_tournament_mode', mode);
    } catch (e) {}
  }

  // Setup click listeners on mode buttons
  if (modeButtons.length > 0) {
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMode = btn.getAttribute('data-mode') || 'official';
        applyGlobalMode(targetMode);
      });
    });

    // Check initial mode from URL or localStorage (default: official)
    const urlParams = new URLSearchParams(window.location.search);
    const urlMode = urlParams.get('mode');
    const savedMode = localStorage.getItem('tag_tournament_mode');
    const initialMode = urlMode || savedMode || 'official';
    
    applyGlobalMode(initialMode);
  }

  // 1. Standings Tab Switcher (Official vs Unofficial / Live)
  const tabOfficial = document.getElementById('tab-standings-official');
  const tabUnofficial = document.getElementById('tab-standings-unofficial');
  const viewOfficial = document.getElementById('view-standings-official');
  const viewUnofficial = document.getElementById('view-standings-unofficial');

  if (tabOfficial && tabUnofficial && viewOfficial && viewUnofficial) {
    tabOfficial.addEventListener('click', () => {
      tabOfficial.classList.add('btn-glass-active');
      tabUnofficial.classList.remove('btn-glass-active');
      viewOfficial.classList.remove('hidden');
      viewUnofficial.classList.add('hidden');
    });

    tabUnofficial.addEventListener('click', () => {
      tabUnofficial.classList.add('btn-glass-active');
      tabOfficial.classList.remove('btn-glass-active');
      viewUnofficial.classList.remove('hidden');
      viewOfficial.classList.add('hidden');
    });
  }

  // 2. Player Card Dual Tab Switchers
  document.querySelectorAll('.player-stat-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.player-card');
      if (!card) return;

      const target = btn.getAttribute('data-target'); // 'official' or 'unofficial'
      
      // Update button styles
      card.querySelectorAll('.player-stat-tab-btn').forEach(b => {
        b.classList.remove('bg-white/20', 'text-white', 'border-amber-400/50', 'border-emerald-400/50');
        b.classList.add('bg-black/20', 'text-slate-400');
      });

      if (target === 'official') {
        btn.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-400/50');
      } else {
        btn.classList.add('bg-amber-500/20', 'text-amber-300', 'border-amber-400/50');
      }

      // Show targeted stats block
      const offBlock = card.querySelector('.player-stats-official');
      const unoffBlock = card.querySelector('.player-stats-unofficial');

      if (offBlock && unoffBlock) {
        if (target === 'official') {
          offBlock.classList.remove('hidden');
          unoffBlock.classList.add('hidden');
        } else {
          unoffBlock.classList.remove('hidden');
          offBlock.classList.add('hidden');
        }
      }
    });
  });

  // 3. Mobile Navigation Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // 4. Image Upload Live Preview
  const imageInputs = document.querySelectorAll('input[type="file"][data-preview-target]');
  imageInputs.forEach(input => {
    input.addEventListener('change', () => {
      const targetId = input.getAttribute('data-preview-target');
      const previewImg = document.getElementById(targetId);
      if (previewImg && input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          previewImg.classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
      }
    });
  });

  // 5. Admin Quick Match Official Toggle via AJAX
  document.querySelectorAll('.admin-toggle-official-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const matchId = btn.getAttribute('data-match-id');
      const currentOfficial = btn.getAttribute('data-is-official') === 'true';
      const targetOfficial = !currentOfficial;

      btn.disabled = true;
      btn.style.opacity = '0.5';

      try {
        const res = await fetch(`/admin/matches/${matchId}/toggle-official`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ is_official: targetOfficial })
        });

        const data = await res.json();
        if (data.success) {
          btn.setAttribute('data-is-official', String(targetOfficial));
          const badge = document.getElementById(`match-badge-${matchId}`);
          
          if (targetOfficial) {
            btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> Set Unofficial`;
            btn.className = 'btn-glass text-xs text-amber-400 hover:text-amber-300 admin-toggle-official-btn';
            if (badge) {
              badge.className = 'badge-official';
              badge.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> OFFICIAL`;
            }
          } else {
            btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Confirm Official`;
            btn.className = 'btn-glass text-xs text-emerald-400 hover:text-emerald-300 admin-toggle-official-btn';
            if (badge) {
              badge.className = 'badge-unofficial';
              badge.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> UNOFFICIAL`;
            }
          }
        }
      } catch (err) {
        console.error('Toggle official error:', err);
      } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  });

  // 6. Overall Analysis Dynamic Toggle & Radio Switcher
  const analysisRadios = document.querySelectorAll('.analysis-radio-toggle');
  const labelAll = document.getElementById('label-filter-all');
  const labelOfficial = document.getElementById('label-filter-official');

  if (analysisRadios.length > 0) {
    analysisRadios.forEach(radio => {
      radio.addEventListener('change', async () => {
        const filterVal = radio.value; // 'all' or 'official'
        const isOfficial = filterVal === 'official';

        // Update active UI styles on labels
        if (labelAll && labelOfficial) {
          if (isOfficial) {
            labelOfficial.className = 'flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm';
            labelAll.className = 'flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs font-mono font-bold text-gray-400 hover:text-gray-200';
          } else {
            labelAll.className = 'flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm';
            labelOfficial.className = 'flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs font-mono font-bold text-gray-400 hover:text-gray-200';
          }
        }

        // Update URL in browser history
        const newUrl = `/analysis?filter=${filterVal}`;
        window.history.pushState({ filter: filterVal }, '', newUrl);

        // Fetch new stats dynamically
        try {
          const res = await fetch(`/api/analysis?filter=${filterVal}`);
          const data = await res.json();
          if (!data.success) return;

          const analysis = data.analysis;

          // Update header badges
          const headerBadge = document.getElementById('analysis-filter-badge');
          if (headerBadge) {
            headerBadge.className = isOfficial ? 'badge-official' : 'badge-unofficial';
            headerBadge.textContent = isOfficial ? 'OFFICIAL VERIFIED' : 'OFFICIAL + LIVE UNOFFICIAL';
          }

          const rankingsBadge = document.getElementById('rankings-filter-indicator');
          if (rankingsBadge) {
            rankingsBadge.className = isOfficial ? 'badge-official shrink-0' : 'badge-unofficial shrink-0';
            rankingsBadge.textContent = isOfficial ? 'OFFICIAL DATA ONLY' : 'INCLUDING LIVE UNOFFICIAL';
          }

          // TAG Specific Career Stats
          const tagMatchesEl = document.getElementById('stat-tag-matches');
          const tagMatchesSubEl = document.getElementById('stat-tag-matches-sub');
          const tagKillsEl = document.getElementById('stat-tag-kills');
          const tagKillsSubEl = document.getElementById('stat-tag-kills-sub');
          const tagBooyahsEl = document.getElementById('stat-tag-booyahs');
          const tagBooyahsSubEl = document.getElementById('stat-tag-booyahs-sub');
          const tagKdEl = document.getElementById('stat-tag-kd');

          if (analysis.tagCareer) {
            if (tagMatchesEl) tagMatchesEl.textContent = analysis.tagCareer.total_matches;
            if (tagMatchesSubEl) tagMatchesSubEl.textContent = `Across ${analysis.tagCareer.tournaments_played} Tournaments`;
            if (tagKillsEl) tagKillsEl.textContent = analysis.tagCareer.total_kills;
            if (tagKillsSubEl) tagKillsSubEl.textContent = `${analysis.tagCareer.avg_kills} Avg Kills / Match`;
            if (tagBooyahsEl) {
              tagBooyahsEl.innerHTML = `<span>${analysis.tagCareer.total_booyahs}</span><span class="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-normal">WINS</span>`;
            }
            if (tagBooyahsSubEl) tagBooyahsSubEl.textContent = `${analysis.tagCareer.win_rate}% Squad Win Rate`;
            if (tagKdEl) tagKdEl.textContent = analysis.tagCareer.total_kd;
          }

          // Key metrics
          const totalTournamentsEl = document.getElementById('stat-total-tournaments');
          if (totalTournamentsEl) totalTournamentsEl.textContent = analysis.totalTournaments;

          const totalMatchesEl = document.getElementById('stat-total-matches');
          if (totalMatchesEl) totalMatchesEl.textContent = analysis.totalMatchesCount;

          const matchesBadge = document.getElementById('stat-matches-badge');
          if (matchesBadge) {
            matchesBadge.className = isOfficial ? 'badge-official text-[10px]' : 'badge-unofficial text-[10px]';
            matchesBadge.textContent = isOfficial ? 'OFFICIAL' : 'ALL';
          }

          const matchesSub = document.getElementById('stat-matches-subtitle');
          if (matchesSub) {
            matchesSub.textContent = isOfficial ? 'Verified official matches' : 'Official + Live matches';
          }

          const teamNameEl = document.getElementById('stat-consistent-team-name');
          const teamDetailsEl = document.getElementById('stat-consistent-team-details');
          if (teamNameEl) {
            teamNameEl.textContent = analysis.mostConsistentTeam ? analysis.mostConsistentTeam.name : 'N/A';
          }
          if (teamDetailsEl) {
            teamDetailsEl.textContent = analysis.mostConsistentTeam 
              ? `Win Rate: ${analysis.mostConsistentTeam.win_rate}% • Score: ${analysis.mostConsistentTeam.consistency_score}`
              : '';
          }

          const fraggerNameEl = document.getElementById('stat-top-fragger-name');
          const fraggerDetailsEl = document.getElementById('stat-top-fragger-details');
          if (fraggerNameEl) {
            fraggerNameEl.textContent = analysis.topFragger ? analysis.topFragger.in_game_name : 'N/A';
          }
          if (fraggerDetailsEl) {
            fraggerDetailsEl.textContent = analysis.topFragger
              ? `${analysis.topFragger.active_kills} Total Kills • ${analysis.topFragger.team_name}`
              : '';
          }

          // Update Leaderboard Table
          const tbody = document.getElementById('ranked-teams-tbody');
          if (tbody) {
            if (analysis.rankedTeams.length === 0) {
              tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-gray-500">No team stats available for current filter.</td></tr>`;
            } else {
              tbody.innerHTML = analysis.rankedTeams.map((t, idx) => {
                const rankClass = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : ''));
                const rankColor = idx === 0 ? 'text-amber-400' : (idx === 1 ? 'text-gray-300' : (idx === 2 ? 'text-amber-600' : 'text-gray-500'));
                return `
                  <tr class="table-row leaderboard-row ${rankClass}">
                    <td class="text-center font-display text-2xl font-bold ${rankColor}">#${idx + 1}</td>
                    <td>
                      <div class="flex items-center gap-3">
                        <img src="${t.logo_url}" alt="" class="w-8 h-8 rounded-lg object-cover bg-gray-900 border border-white/10" onerror="this.src='https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&auto=format&fit=crop'">
                        <div>
                          <a href="/team/${t.team_id}" class="font-bold text-white hover:text-[#ff4e00] transition-colors">${t.name}</a>
                          <span class="text-xs font-mono text-[#ff4e00] ml-1">[${t.tag}]</span>
                        </div>
                      </div>
                    </td>
                    <td class="text-center font-mono text-gray-300">${t.total_matches}</td>
                    <td class="text-center font-mono text-gray-300">${t.total_kills}</td>
                    <td class="text-center font-display text-xl font-bold text-amber-400">${t.booyahs}</td>
                    <td class="text-center font-mono text-emerald-400 font-bold">${t.win_rate}%</td>
                    <td class="text-center font-mono text-gray-300">#${t.avg_placement}</td>
                    <td class="text-center font-mono text-amber-300 font-bold">${t.consistency_score}</td>
                    <td class="text-right font-display text-2xl font-bold text-[#ff4e00]">${t.total_points}</td>
                  </tr>
                `;
              }).join('');
            }
          }

          // Update Top Players Grid
          const playersGrid = document.getElementById('top-players-grid');
          if (playersGrid) {
            playersGrid.innerHTML = analysis.topPlayers.map((p, idx) => {
              const rankColor = idx === 0 ? 'text-amber-400' : (idx === 1 ? 'text-gray-300' : (idx === 2 ? 'text-amber-600' : 'text-gray-600'));
              return `
                <div class="glass-card player-card p-5 flex items-center justify-between group">
                  <div class="flex items-center gap-3">
                    <span class="font-display text-2xl font-bold ${rankColor}">#${idx + 1}</span>
                    <img src="${p.avatar_url}" alt="" class="w-12 h-12 rounded-xl object-cover border border-white/10" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop'">
                    <div>
                      <a href="/player/${p.player_id}" class="font-display text-xl font-bold text-white group-hover:text-[#ff4e00] transition-colors block">
                        ${p.in_game_name}
                      </a>
                      <p class="text-xs text-gray-400 font-mono">${p.team_name}</p>
                    </div>
                  </div>
                  <div class="text-right font-mono">
                    <div class="text-xl font-bold text-[#ff4e00]">${p.active_kills} Kills</div>
                    <div class="text-xs text-gray-400">${p.active_avg_kills} Avg/Match</div>
                  </div>
                </div>
              `;
            }).join('');
          }

        } catch (e) {
          console.error('Failed to dynamically fetch analysis:', e);
        }
      });
    });
  }

  // ==================== INSTANT NAVIGATION & LINK PREFETCHING ====================
  // Ensure top progress bar element exists
  let progressBar = document.getElementById('page-progress-bar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'page-progress-bar';
    document.body.appendChild(progressBar);
  }

  function startProgressBar() {
    if (!progressBar) return;
    progressBar.classList.add('active');
    progressBar.style.width = '30%';
    setTimeout(() => {
      if (progressBar.classList.contains('active')) {
        progressBar.style.width = '75%';
      }
    }, 150);
  }

  function completeProgressBar() {
    if (!progressBar) return;
    progressBar.style.width = '100%';
    setTimeout(() => {
      progressBar.classList.remove('active');
      progressBar.style.width = '0%';
    }, 300);
  }

  // Link Prefetch Cache
  const prefetchedUrls = new Set();
  function prefetchLink(url) {
    if (!url || prefetchedUrls.has(url) || url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('http')) return;
    prefetchedUrls.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }

  // Prefetch on hover/touchstart & trigger progress bar on click
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest('a');
    if (a && a.href && a.origin === window.location.origin) {
      prefetchLink(a.pathname + a.search);
    }
  }, { passive: true });

  document.addEventListener('touchstart', (e) => {
    const a = e.target.closest('a');
    if (a && a.href && a.origin === window.location.origin) {
      prefetchLink(a.pathname + a.search);
    }
  }, { passive: true });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && a.href && a.origin === window.location.origin && !a.target && !a.hasAttribute('download')) {
      // If clicking a new page link
      if (a.pathname !== window.location.pathname || a.search !== window.location.search) {
        startProgressBar();
      }
    }
  });

  // Also trigger progress bar on form submission
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form && !form.target) {
      startProgressBar();
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        submitBtn.style.opacity = '0.7';
        submitBtn.style.pointerEvents = 'none';
      }
    }
  });
});

window.toggleHomeTotalPoints = function() {
  const card = document.getElementById('home-total-points-card');
  if (card) {
    card.classList.toggle('hidden');
    if (!card.classList.contains('hidden')) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
};

