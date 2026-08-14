import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { db, memoryDb, isPostgresActive, resetAllWebsiteData } from '../config/db.js';
import { TournamentService } from '../services/tournamentService.js';
import { processAndUploadImage } from '../services/imageService.js';

const router = Router();

// Multer memory storage for image processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const ADMIN_AUTH_TOKEN = 'tag_admin_authorized_sujal_2026';

// Admin Authentication Middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const isSessionAdmin = Boolean(req.session && (req.session as any).isAdmin);
  const isCookieAdmin = req.cookies?.tag_admin_token === ADMIN_AUTH_TOKEN || req.cookies?.tag_admin_session === '1';
  const isQueryAdmin = req.query?.auth_token === ADMIN_AUTH_TOKEN;
  const isHeaderAdmin = req.headers['x-admin-token'] === ADMIN_AUTH_TOKEN;

  if (isSessionAdmin || isCookieAdmin || isQueryAdmin || isHeaderAdmin) {
    if (req.session) {
      (req.session as any).isAdmin = true;
    }
    return next();
  }
  return res.redirect('/admin/login?redirect=' + encodeURIComponent(req.originalUrl));
}

// Invalidate cache immediately on all admin data modifications
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST') {
    TournamentService.invalidateCache();
  }
  next();
});

// 1. Admin Login Page (GET)
router.get('/login', (req: Request, res: Response) => {
  const isSessionAdmin = Boolean(req.session && (req.session as any).isAdmin);
  const isCookieAdmin = req.cookies?.tag_admin_token === ADMIN_AUTH_TOKEN || req.cookies?.tag_admin_session === '1';
  const isQueryAdmin = req.query?.auth_token === ADMIN_AUTH_TOKEN;

  if (isSessionAdmin || isCookieAdmin || isQueryAdmin) {
    return res.redirect('/admin');
  }
  res.render('admin/login', {
    title: 'Admin Access — TAGFREEFIREMAX',
    error: req.query.error as string || null,
    redirect: req.query.redirect as string || '/admin'
  });
});

// 2. Admin Login (POST)
router.post('/login', (req: Request, res: Response) => {
  const { password, redirect } = req.body;
  const configuredPassword = process.env.ADMIN_PASSWORD || 'Taggontoppp379@';
  const validPasswords = [
    'Taggontoppp379@',
    'admin_tagfreefiremax',
    configuredPassword.trim()
  ];

  const submittedPass = (password || '').trim();

  if (submittedPass && validPasswords.includes(submittedPass)) {
    if (req.session) {
      (req.session as any).isAdmin = true;
    }

    // Set cookie token for iframe persistence
    res.cookie('tag_admin_token', ADMIN_AUTH_TOKEN, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/'
    });

    res.cookie('tag_admin_session', '1', {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    const targetUrl = (redirect || '/admin') + ((redirect && redirect.includes('?')) ? `&auth_token=${ADMIN_AUTH_TOKEN}` : `?auth_token=${ADMIN_AUTH_TOKEN}`);

    // Handle AJAX requests
    if (req.xhr || req.headers.accept?.includes('application/json') || req.body.ajax === 'true') {
      if (req.session) {
        req.session.save(() => {
          return res.json({ success: true, redirect: targetUrl, token: ADMIN_AUTH_TOKEN });
        });
      } else {
        return res.json({ success: true, redirect: targetUrl, token: ADMIN_AUTH_TOKEN });
      }
      return;
    }

    if (req.session) {
      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        return res.redirect(targetUrl);
      });
    } else {
      return res.redirect(targetUrl);
    }
    return;
  }

  if (req.xhr || req.headers.accept?.includes('application/json') || req.body.ajax === 'true') {
    return res.status(401).json({
      success: false,
      error: 'Invalid admin credentials. Please verify your password.'
    });
  }

  res.render('admin/login', {
    title: 'Admin Access — TAGFREEFIREMAX',
    error: 'Invalid admin credentials. Please verify your password.',
    redirect: redirect || '/admin'
  });
});

// 3. Admin Logout
router.get('/logout', (req: Request, res: Response) => {
  res.clearCookie('tag_admin_token', { path: '/' });
  res.clearCookie('tag_admin_session', { path: '/' });
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/?success=' + encodeURIComponent('Logged out of admin session.'));
    });
  } else {
    res.redirect('/?success=' + encodeURIComponent('Logged out of admin session.'));
  }
});

// Protect all routes below this line
router.use(requireAdmin);

// 4. Admin Dashboard Overview
router.get('/', async (req: Request, res: Response) => {
  try {
    const tournaments = await TournamentService.getAllTournaments();
    const teams = await TournamentService.getAllTeams();
    const players = await TournamentService.getAllPlayers();
    
    let totalMatches = 0;
    let officialMatches = 0;
    let unofficialMatches = 0;

    if (isPostgresActive) {
      const mRes = await db.query('SELECT is_official, COUNT(*) as count FROM matches GROUP BY is_official');
      mRes.rows.forEach(r => {
        const count = parseInt(r.count, 10);
        totalMatches += count;
        if (r.is_official) officialMatches += count;
        else unofficialMatches += count;
      });
    } else {
      totalMatches = memoryDb.matches.length;
      officialMatches = memoryDb.matches.filter(m => m.is_official).length;
      unofficialMatches = totalMatches - officialMatches;
    }

    const currentTourney = tournaments.find(t => t.is_current) || null;

    res.render('admin/dashboard', {
      title: 'Admin Command Center — TAGFREEFIREMAX',
      tournaments,
      teams,
      players,
      totalMatches,
      officialMatches,
      unofficialMatches,
      currentTourney,
      success: req.query.success as string || null
    });
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// ==================== TOURNAMENT MANAGEMENT ====================

// List Tournaments
router.get('/tournaments', async (req: Request, res: Response) => {
  const tournaments = await TournamentService.getAllTournaments();
  res.render('admin/tournaments', {
    title: 'Tournament Manager — TAGFREEFIREMAX',
    tournaments,
    success: req.query.success as string || null
  });
});

// New Tournament Form
router.get('/tournaments/new', (req: Request, res: Response) => {
  res.render('admin/tournament_form', {
    title: 'Create Tournament — Admin',
    tournament: null
  });
});

// Create Tournament (POST)
router.post('/tournaments/new', upload.single('banner'), async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      game_mode, 
      start_date, 
      end_date, 
      status, 
      is_current, 
      prize_pool, 
      description,
      banner_url_input,
      is_official_tournament,
      initial_matches_count,
      selected_maps
    } = req.body;

    let bannerUrl = banner_url_input?.trim() || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop';

    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'tournaments', 1200, 85);
      bannerUrl = processed.url;
    }

    const isCurrentBool = is_current === 'true' || is_current === 'on';
    const isOfficialBool = is_official_tournament !== 'false';

    if (isCurrentBool) {
      // Demote existing current tournaments
      await db.query('UPDATE tournaments SET is_current = FALSE');
    }

    const insertResult = await db.query(`
      INSERT INTO tournaments (name, game_mode, banner_url, start_date, end_date, status, is_current, prize_pool, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [name, game_mode || 'Battle Royale Squad', bannerUrl, start_date || null, end_date || null, status || 'ongoing', isCurrentBool, prize_pool || '$0', description || '']);

    const newTournamentId = insertResult.rows[0].id;

    // Handle auto-seed matches with map rotation if requested
    const matchCount = parseInt(initial_matches_count, 10) || 0;
    if (matchCount > 0) {
      let mapsPool: string[] = [];
      if (Array.isArray(selected_maps)) {
        mapsPool = selected_maps;
      } else if (typeof selected_maps === 'string') {
        mapsPool = [selected_maps];
      }
      if (mapsPool.length === 0) {
        mapsPool = ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'Nexterra'];
      }

      // Fetch teams to create basic match results
      const teamsRes = await db.query('SELECT id, name, tag FROM teams LIMIT 12');
      const teams = teamsRes.rows;

      for (let i = 1; i <= matchCount; i++) {
        const mapName = mapsPool[(i - 1) % mapsPool.length];
        const matchRes = await db.query(`
          INSERT INTO matches (tournament_id, match_number, map_name, is_official, notes)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          newTournamentId, 
          i, 
          mapName, 
          isOfficialBool, 
          `Round ${i} • ${mapName} Rotation`
        ]);

        const matchId = matchRes.rows[0].id;

        // If teams exist, initialize match placements
        if (teams.length > 0) {
          for (let p = 0; p < teams.length; p++) {
            const team = teams[p];
            const placement = p + 1;
            const placementPts = placement === 1 ? 12 : (placement === 2 ? 9 : (placement === 3 ? 8 : (placement === 4 ? 7 : (placement === 5 ? 6 : (placement === 6 ? 5 : (placement === 7 ? 4 : (placement === 8 ? 3 : (placement === 9 ? 2 : (placement === 10 ? 1 : 0)))))))));
            const kills = team.tag === 'TAG' ? (placement === 1 ? 9 : 5) : Math.floor(Math.random() * 4);
            const totalPoints = placementPts + kills;

            await db.query(`
              INSERT INTO match_results (match_id, team_id, placement, kills, placement_points, total_points)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [matchId, team.id, placement, kills, placementPts, totalPoints]);
          }
        }
      }
    }

    res.redirect('/admin/tournaments?success=' + encodeURIComponent('Tournament started and featured successfully!'));
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to create tournament: ' + err.message });
  }
});

// Edit Tournament Form
router.get('/tournaments/:id/edit', async (req: Request, res: Response) => {
  const t = await TournamentService.getTournamentById(parseInt(req.params.id, 10));
  if (!t) return res.status(404).render('error', { message: 'Tournament not found.' });
  res.render('admin/tournament_form', {
    title: `Edit ${t.name} — Admin`,
    tournament: t
  });
});

// Update Tournament (POST)
router.post('/tournaments/:id/edit', upload.single('banner'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, game_mode, start_date, end_date, status, is_current, prize_pool, description, banner_url_input } = req.body;
    const existing = await TournamentService.getTournamentById(id);

    let bannerUrl = banner_url_input?.trim() || existing?.banner_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop';
    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'tournaments', 1200, 85);
      bannerUrl = processed.url;
    }

    const isCurrentBool = is_current === 'true' || is_current === 'on';

    if (isCurrentBool) {
      await db.query('UPDATE tournaments SET is_current = FALSE');
    }

    await db.query(`
      UPDATE tournaments 
      SET name = $1, game_mode = $2, banner_url = $3, start_date = $4, end_date = $5, status = $6, is_current = $7, prize_pool = $8, description = $9
      WHERE id = $10
    `, [name, game_mode, bannerUrl, start_date || null, end_date || null, status || 'ongoing', isCurrentBool, prize_pool || '$0', description || '', id]);

    res.redirect('/admin/tournaments?success=' + encodeURIComponent('Tournament updated successfully!'));
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to update tournament: ' + err.message });
  }
});

// Set as Current Tournament
router.post('/tournaments/:id/set-current', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await db.query('UPDATE tournaments SET is_current = FALSE');
  await db.query('UPDATE tournaments SET is_current = TRUE WHERE id = $1', [id]);
  res.redirect('/admin/tournaments?success=' + encodeURIComponent('Featured current tournament updated.'));
});

// Delete Tournament
router.post('/tournaments/:id/delete', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await db.query('DELETE FROM tournaments WHERE id = $1', [id]);
  res.redirect('/admin/tournaments?success=' + encodeURIComponent('Tournament deleted.'));
});

// ==================== MATCHES & SCORES ====================

// List Matches
router.get('/matches', async (req: Request, res: Response) => {
  const tournaments = await TournamentService.getAllTournaments();
  const selectedTourneyId = req.query.tournament_id ? parseInt(req.query.tournament_id as string, 10) : (tournaments.find(t => t.is_current)?.id || tournaments[0]?.id || 1);
  const matches = await TournamentService.getTournamentMatches(selectedTourneyId);

  res.render('admin/matches', {
    title: 'Match Scores & Verification — TAGFREEFIREMAX',
    tournaments,
    selectedTourneyId,
    matches,
    success: req.query.success as string || null
  });
});

// New Match Form
router.get('/matches/new', async (req: Request, res: Response) => {
  const tournaments = await TournamentService.getAllTournaments();
  const teams = await TournamentService.getAllTeams();
  const selectedTourneyId = req.query.tournament_id ? parseInt(req.query.tournament_id as string, 10) : (tournaments.find(t => t.is_current)?.id || tournaments[0]?.id || 1);
  const existingMatches = await TournamentService.getTournamentMatches(selectedTourneyId);
  const nextMatchNumber = existingMatches.length > 0 ? Math.max(...existingMatches.map(m => m.match_number)) + 1 : 1;

  res.render('admin/match_form', {
    title: 'Enter Match Scoreboard — Admin',
    tournaments,
    teams,
    selectedTourneyId,
    nextMatchNumber,
    match: null
  });
});

// Create Match (POST)
router.post('/matches/new', async (req: Request, res: Response) => {
  try {
    const { tournament_id, match_number, map_name, played_at, status, is_official, notes } = req.body;
    const isOfficialBool = is_official === 'true' || is_official === 'on' || is_official === true;

    // Create match entry
    const matchRes = await db.query(`
      INSERT INTO matches (tournament_id, match_number, map_name, played_at, status, is_official, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      parseInt(tournament_id, 10),
      parseInt(match_number, 10),
      map_name || 'Bermuda',
      played_at ? new Date(played_at) : new Date(),
      status || 'completed',
      isOfficialBool,
      notes || ''
    ]);

    const matchId = matchRes.rows[0]?.id || memoryDb.matches[memoryDb.matches.length - 1]?.id;

    // Parse team results
    const rawTeamIds = req.body.team_id || req.body.team_ids;
    const rawPlacements = req.body.placement || req.body.placements;
    const rawKills = req.body.kills || req.body.kill;

    const teamIds = Array.isArray(rawTeamIds) ? rawTeamIds : (rawTeamIds ? [rawTeamIds] : []);
    const placements = Array.isArray(rawPlacements) ? rawPlacements : (rawPlacements ? [rawPlacements] : []);
    const killsArr = Array.isArray(rawKills) ? rawKills : (rawKills ? [rawKills] : []);

    if (teamIds.length > 0) {
      for (let i = 0; i < teamIds.length; i++) {
        const teamId = parseInt(teamIds[i], 10);
        if (isNaN(teamId)) continue;
        const placement = parseInt(placements[i], 10) || (i + 1);
        const kills = parseInt(killsArr[i], 10) || 0;
        
        // Placement points: 1st=12, 2nd=9, 3rd=8, 4th=7, 5th=6, 6th=5, etc.
        const placementPoints = placement === 1 ? 12 : Math.max(0, 10 - placement);
        const totalPoints = kills + placementPoints;

        await db.query(`
          INSERT INTO match_team_results (match_id, team_id, placement, kills, placement_points, kill_points, total_points, is_official)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [matchId, teamId, placement, kills, placementPoints, kills, totalPoints, isOfficialBool]);
      }
    }

    res.redirect(`/admin/matches?tournament_id=${tournament_id}&success=` + encodeURIComponent(`Match #${match_number} saved as ${isOfficialBool ? 'OFFICIAL' : 'UNOFFICIAL / LIVE'}.`));
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to create match: ' + err.message });
  }
});

// Toggle Match Official Status (Locks in or unlocks)
router.post('/matches/:id/toggle-official', async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.id, 10);
    const targetOfficial = req.body.is_official === 'true' || req.body.is_official === true;
    
    await db.query('UPDATE matches SET is_official = $1 WHERE id = $2', [targetOfficial, matchId]);
    await db.query('UPDATE match_team_results SET is_official = $1 WHERE match_id = $2', [targetOfficial, matchId]);
    await db.query('UPDATE match_player_stats SET is_official = $1 WHERE match_id = $2', [targetOfficial, matchId]);

    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ success: true, is_official: targetOfficial });
    }

    res.redirect('back');
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Match
router.post('/matches/:id/delete', async (req: Request, res: Response) => {
  const matchId = parseInt(req.params.id, 10);
  await db.query('DELETE FROM matches WHERE id = $1', [matchId]);
  res.redirect('back');
});

// ==================== TEAMS MANAGEMENT ====================

router.get('/teams', async (req: Request, res: Response) => {
  const teams = await TournamentService.getAllTeams();
  res.render('admin/teams', {
    title: 'Teams & Organizations — Admin',
    teams,
    success: req.query.success as string || null,
    error: req.query.error as string || null
  });
});

router.post('/teams/new', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const { name, tag, country, logo_url_input } = req.body;
    let logoUrl = logo_url_input?.trim() || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&auto=format&fit=crop';

    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'teams', 400, 85);
      logoUrl = processed.url;
    }

    await db.query(`
      INSERT INTO teams (name, tag, logo_url, country)
      VALUES ($1, $2, $3, $4)
    `, [name, tag.toUpperCase(), logoUrl, country || 'Global']);

    TournamentService.invalidateCache();
    res.redirect('/admin/teams?success=' + encodeURIComponent(`Team ${name} registered successfully!`));
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// Update Registered Team (Edit details and/or upload new logo)
router.post('/teams/:id/edit', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, tag, country, logo_url } = req.body;
    const existing = await TournamentService.getTeamById(id);

    let finalLogoUrl = existing?.logo_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&auto=format&fit=crop';
    
    if (logo_url && logo_url.trim()) {
      finalLogoUrl = logo_url.trim();
    }

    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'teams', 400, 85);
      finalLogoUrl = processed.url;
    }

    const finalName = name?.trim() || existing?.name || 'Squad';
    const finalTag = tag ? tag.trim().toUpperCase() : (existing?.tag || 'TAG');
    const finalCountry = country?.trim() || existing?.country || 'Global';

    await db.query(`
      UPDATE teams 
      SET name = $1, tag = $2, logo_url = $3, country = $4
      WHERE id = $5
    `, [finalName, finalTag, finalLogoUrl, finalCountry, id]);

    TournamentService.invalidateCache();

    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      return res.json({ success: true, logo_url: finalLogoUrl, message: `Team ${finalName} updated successfully!` });
    }

    const redirectUrl = req.body.redirect_to || ('/admin/teams?success=' + encodeURIComponent(`Team ${finalName} updated successfully!`));
    res.redirect(redirectUrl);
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to update team: ' + err.message });
  }
});

// Quick Logo Upload for Registered Team
router.post('/teams/:id/logo', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await TournamentService.getTeamById(id);
    let logoUrl = req.body.logo_url?.trim() || existing?.logo_url;

    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'teams', 400, 85);
      logoUrl = processed.url;
    }

    if (!logoUrl) {
      return res.redirect('/admin/teams?error=' + encodeURIComponent('No image provided.'));
    }

    await db.query(`UPDATE teams SET logo_url = $1 WHERE id = $2`, [logoUrl, id]);
    TournamentService.invalidateCache();

    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      return res.json({ success: true, logo_url: logoUrl, message: 'Logo updated successfully!' });
    }

    const redirectUrl = req.body.redirect_to || ('/admin/teams?success=' + encodeURIComponent('Team logo updated successfully!'));
    res.redirect(redirectUrl);
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to update team logo: ' + err.message });
  }
});

router.post('/teams/:id/delete', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await db.query('DELETE FROM teams WHERE id = $1', [id]);
  TournamentService.invalidateCache();
  res.redirect('/admin/teams?success=' + encodeURIComponent('Team removed.'));
});

// ==================== PLAYERS MANAGEMENT ====================

router.get('/players', async (req: Request, res: Response) => {
  const players = await TournamentService.getAllPlayers();
  const teams = await TournamentService.getAllTeams();

  res.render('admin/players', {
    title: 'Player Roster Management — Admin',
    players,
    teams,
    success: req.query.success as string || null,
    error: req.query.error as string || null
  });
});

// Create Player with Photo Upload + Sharp Compression + Cloudinary
router.post('/players/new', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const { team_id, name, in_game_name, role, free_fire_uid, avatar_url_input } = req.body;
    let avatarUrl = avatar_url_input?.trim() || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop';

    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'players', 400, 85);
      avatarUrl = processed.url;
    }

    await db.query(`
      INSERT INTO players (team_id, name, in_game_name, role, avatar_url, free_fire_uid)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      team_id ? parseInt(team_id, 10) : null,
      name || in_game_name,
      in_game_name,
      role || 'Rusher',
      avatarUrl,
      free_fire_uid || ''
    ]);

    TournamentService.invalidateCache();
    res.redirect('/admin/players?success=' + encodeURIComponent(`Player ${in_game_name} created successfully!`));
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// Update Player (Full edit and/or upload photo)
router.post('/players/:id/edit', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { team_id, name, in_game_name, role, free_fire_uid, avatar_url } = req.body;
    const existing = await TournamentService.getPlayerStats(id);

    let finalAvatarUrl = existing?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop';
    
    if (avatar_url && avatar_url.trim()) {
      finalAvatarUrl = avatar_url.trim();
    }

    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'players', 400, 85);
      finalAvatarUrl = processed.url;
    }

    const finalTeamId = team_id !== undefined && team_id !== '' ? parseInt(team_id, 10) : (existing?.team_id || null);
    const finalName = name?.trim() !== undefined && name?.trim() !== '' ? name.trim() : (existing?.player_name || '');
    const finalIgn = in_game_name?.trim() || existing?.in_game_name || 'Player';
    const finalRole = role?.trim() || existing?.role || 'Rusher';
    const finalUid = free_fire_uid !== undefined ? free_fire_uid.trim() : (existing?.free_fire_uid || '');

    await db.query(`
      UPDATE players 
      SET team_id = $1, name = $2, in_game_name = $3, role = $4, avatar_url = $5, free_fire_uid = $6
      WHERE id = $7
    `, [
      finalTeamId,
      finalName,
      finalIgn,
      finalRole,
      finalAvatarUrl,
      finalUid,
      id
    ]);

    TournamentService.invalidateCache();

    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      return res.json({ success: true, avatar_url: finalAvatarUrl, message: `Player ${finalIgn} updated successfully!` });
    }

    const redirectUrl = req.body.redirect_to || ('/admin/players?success=' + encodeURIComponent(`Player ${finalIgn} updated successfully!`));
    res.redirect(redirectUrl);
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to update player: ' + err.message });
  }
});

// Quick Photo Upload for Registered Player
router.post('/players/:id/photo', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await TournamentService.getPlayerStats(id);
    let avatarUrl = req.body.avatar_url?.trim() || existing?.avatar_url;

    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'players', 400, 85);
      avatarUrl = processed.url;
    }

    if (!avatarUrl) {
      return res.redirect('/admin/players?error=' + encodeURIComponent('No photo provided.'));
    }

    await db.query(`UPDATE players SET avatar_url = $1 WHERE id = $2`, [avatarUrl, id]);
    TournamentService.invalidateCache();

    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      return res.json({ success: true, avatar_url: avatarUrl, message: 'Player photo updated successfully!' });
    }

    const redirectUrl = req.body.redirect_to || ('/admin/players?success=' + encodeURIComponent('Player photo updated successfully!'));
    res.redirect(redirectUrl);
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to upload player photo: ' + err.message });
  }
});

router.post('/players/:id/delete', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await db.query('DELETE FROM players WHERE id = $1', [id]);
  TournamentService.invalidateCache();
  res.redirect('/admin/players?success=' + encodeURIComponent('Player removed.'));
});

// ==================== SITE SETTINGS & BACKGROUND ====================

router.get('/settings', async (req: Request, res: Response) => {
  const settings = await TournamentService.getSiteSettings();
  res.render('admin/settings', {
    title: 'Site Customization & Background — Admin',
    settings,
    currentBg: settings?.site_background_url || null,
    siteTitle: settings?.site_title || 'TAGFREEFIREMAX',
    siteTagline: settings?.site_tagline || 'Premier Free Fire MAX Esports Hub',
    success: req.query.success as string || null
  });
});

// Upload Site Background Image (Sharp compressed + Cloudinary + DB setting)
router.post('/settings/background', upload.any(), async (req: Request, res: Response) => {
  try {
    const uploadedFile = (req.files && Array.isArray(req.files) && req.files.length > 0) ? req.files[0] : req.file;

    if (uploadedFile) {
      const processed = await processAndUploadImage(uploadedFile.buffer, 'backgrounds', 1920, 80);
      await TournamentService.updateSiteSetting('site_background_url', processed.url);
      return res.redirect('/admin/settings?success=' + encodeURIComponent('Site background image updated and compressed successfully!'));
    }
    
    if (req.body.background_url) {
      await TournamentService.updateSiteSetting('site_background_url', req.body.background_url);
      return res.redirect('/admin/settings?success=' + encodeURIComponent('Site background URL saved!'));
    }

    res.redirect('/admin/settings');
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to update background: ' + err.message });
  }
});

router.post('/settings/general', async (req: Request, res: Response) => {
  const { site_title, site_tagline } = req.body;
  if (site_title) await TournamentService.updateSiteSetting('site_title', site_title);
  if (site_tagline) await TournamentService.updateSiteSetting('site_tagline', site_tagline);
  res.redirect('/admin/settings?success=' + encodeURIComponent('General settings saved!'));
});

// Reset Website Data (Clears all tournaments, matches, and stats to 0)
router.post('/settings/reset-database', async (req: Request, res: Response) => {
  try {
    await resetAllWebsiteData();
    TournamentService.invalidateCache();
    res.redirect('/admin/settings?success=' + encodeURIComponent('Website data successfully reset to 0! All tournaments and matches cleared.'));
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to reset database: ' + err.message });
  }
});

export default router;
