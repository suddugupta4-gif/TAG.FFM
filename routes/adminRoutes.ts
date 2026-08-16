import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db, memoryDb, isPostgresActive, resetAllWebsiteData } from '../config/db.js';
import { TournamentService } from '../services/tournamentService.js';
import { processAndUploadImage } from '../services/imageService.js';

const router = Router();

// Multer memory storage for image processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const OFFICIAL_FF_MAPS = ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'Nexterra'];

// Dynamic in-memory store for active admin tickets/tokens generated ONLY upon valid password verification
export const activeAdminTokens = new Map<string, number>();

export function issueAdminToken(): string {
  const token = 'tk_' + crypto.randomBytes(16).toString('hex');
  activeAdminTokens.set(token, Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiry
  return token;
}

export function revokeAdminToken(token?: string): void {
  if (token && activeAdminTokens.has(token)) {
    activeAdminTokens.delete(token);
  }
}

function extractToken(val: any): string | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return val[0];
  if (typeof val === 'string') return val;
  return undefined;
}

export function validateAdminRequest(req: Request): { isValid: boolean; token?: string } {
  // 1. Check active session
  if (req.session && (req.session as any).isAdmin === true) {
    return { isValid: true, token: (req.session as any).adminToken || 'tag_admin_session' };
  }

  // 2. Check secure admin cookie
  const cookieToken = req.cookies?.admin_session_token || req.cookies?.tag_admin_session;
  if (cookieToken && activeAdminTokens.has(cookieToken)) {
    const expiry = activeAdminTokens.get(cookieToken)!;
    if (Date.now() < expiry) {
      if (req.session) {
        (req.session as any).isAdmin = true;
        (req.session as any).adminToken = cookieToken;
      }
      return { isValid: true, token: cookieToken };
    } else {
      activeAdminTokens.delete(cookieToken);
    }
  }

  // 3. Check explicit auth token in query or headers
  const rawToken = extractToken(req.query?.tk) || extractToken(req.query?.auth_token) || (req.headers['x-admin-token'] as string);
  if (rawToken && activeAdminTokens.has(rawToken)) {
    const expiry = activeAdminTokens.get(rawToken)!;
    if (Date.now() < expiry) {
      if (req.session) {
        (req.session as any).isAdmin = true;
        (req.session as any).adminToken = rawToken;
      }
      return { isValid: true, token: rawToken };
    } else {
      activeAdminTokens.delete(rawToken);
    }
  }

  return { isValid: false };
}

function resolveMapName(rawMap?: string, defaultMap = 'Bermuda'): string {
  if (!rawMap || rawMap === 'Random' || rawMap === 'random') {
    return OFFICIAL_FF_MAPS[Math.floor(Math.random() * OFFICIAL_FF_MAPS.length)];
  }
  return rawMap;
}

// Admin Authentication Middleware: Requires valid admin login
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = validateAdminRequest(req);
  if (auth.isValid) {
    res.locals.isAdmin = true;
    res.locals.activeAdminToken = auth.token || '';
    return next();
  }

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin session required.' });
  }

  const redirectUrl = req.originalUrl && !req.originalUrl.includes('/admin/login') && !req.originalUrl.includes('/admin/logout')
    ? req.originalUrl
    : '/admin';

  return res.redirect('/admin/login?redirect=' + encodeURIComponent(redirectUrl));
}

// Redirect helper that cleanly redirects to the target admin URL
export function adminRedirect(req: Request, res: Response, targetUrl: string) {
  const token = (req.session as any)?.adminToken || (req.query?.tk as string) || req.cookies?.admin_session_token;
  if (token && !targetUrl.includes('tk=')) {
    const sep = targetUrl.includes('?') ? '&' : '?';
    return res.redirect(`${targetUrl}${sep}tk=${token}`);
  }
  return res.redirect(targetUrl);
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
  const auth = validateAdminRequest(req);
  if (auth.isValid) {
    return res.redirect(req.query.redirect as string || '/admin');
  }

  res.render('admin/login', {
    title: 'Admin Access — TAGFREEFIREMAX',
    error: req.query.error as string || null,
    success: req.query.success as string || null,
    redirect: req.query.redirect as string || '/admin'
  });
});

// 2. Admin Login (POST) - Validates configured password and establishes session
router.post('/login', (req: Request, res: Response) => {
  const { password, redirect } = req.body;
  const adminPassword = (process.env.ADMIN_PASSWORD || 'Taggontoppp379@').trim();
  const enteredPassword = (password || '').trim();

  if (!enteredPassword || enteredPassword !== adminPassword) {
    if (req.xhr || req.headers.accept?.includes('application/json') || req.body.ajax === 'true') {
      return res.status(401).json({ success: false, message: 'Invalid admin password. Please try again.' });
    }
    return res.render('admin/login', {
      title: 'Admin Access — TAGFREEFIREMAX',
      error: 'Invalid admin password. Please try again.',
      success: null,
      redirect: redirect || '/admin'
    });
  }

  const sessionToken = issueAdminToken();

  if (req.session) {
    (req.session as any).isAdmin = true;
    (req.session as any).adminToken = sessionToken;
  }

  try {
    res.cookie('admin_session_token', sessionToken, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: false,
      httpOnly: true,
      path: '/'
    });
  } catch (_) {}

  const cleanRedirect = redirect && !redirect.includes('/admin/login') && !redirect.includes('/admin/logout') ? redirect : '/admin';

  if (req.xhr || req.headers.accept?.includes('application/json') || req.body.ajax === 'true') {
    return res.json({ success: true, redirect: cleanRedirect, token: sessionToken });
  }

  return res.redirect(cleanRedirect);
});

// 3. Admin Logout (Destroys session and revokes admin access completely)
router.get('/logout', (req: Request, res: Response) => {
  const token = 
    (req.query?.tk as string) || 
    (req.query?.auth_token as string) || 
    req.cookies?.admin_session_token || 
    (req.session as any)?.adminToken;
  
  if (token) {
    revokeAdminToken(token);
  }

  res.clearCookie('connect.sid', { path: '/' });
  res.clearCookie('admin_session_token', { path: '/' });
  res.clearCookie('tag_admin_session', { path: '/' });
  res.clearCookie('tag_admin_token', { path: '/' });
  
  if (req.session) {
    (req.session as any).isAdmin = false;
    (req.session as any).adminToken = undefined;
    req.session.destroy(() => {
      res.redirect('/admin/login?success=' + encodeURIComponent('You have logged out successfully.'));
    });
  } else {
    res.redirect('/admin/login?success=' + encodeURIComponent('You have logged out successfully.'));
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
router.get('/tournaments/new', async (req: Request, res: Response) => {
  const [teams, allTournaments, allPlayers] = await Promise.all([
    TournamentService.getAllTeams(),
    TournamentService.getAllTournaments(),
    TournamentService.getAllPlayers()
  ]);
  res.render('admin/tournament_form', {
    title: 'Create Tournament — Admin',
    tournament: null,
    teams,
    standings: [],
    matches: [],
    allTournaments,
    players: allPlayers,
    nextMatchNumber: 1
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
      standings_team_id,
      standings_matches,
      standings_booyahs,
      standings_kills,
      standings_place_pts,
      standings_total_pts
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

    // Handle Standings Editor entries if provided
    if (standings_team_id) {
      const teamIds = Array.isArray(standings_team_id) ? standings_team_id : [standings_team_id];
      const matchesArr = Array.isArray(standings_matches) ? standings_matches : (standings_matches ? [standings_matches] : []);
      const booyahsArr = Array.isArray(standings_booyahs) ? standings_booyahs : (standings_booyahs ? [standings_booyahs] : []);
      const killsArr = Array.isArray(standings_kills) ? standings_kills : (standings_kills ? [standings_kills] : []);
      const placePtsArr = Array.isArray(standings_place_pts) ? standings_place_pts : (standings_place_pts ? [standings_place_pts] : []);
      const totalPtsArr = Array.isArray(standings_total_pts) ? standings_total_pts : (standings_total_pts ? [standings_total_pts] : []);

      // Check if any team has scored points
      const hasAnyScore = totalPtsArr.some((p: any) => Number(p) > 0) || killsArr.some((k: any) => Number(k) > 0);
      if (hasAnyScore) {
        // Create base match to hold the team results
        const mRes = await db.query(`
          INSERT INTO matches (tournament_id, match_number, map_name, played_at, status, is_official, notes)
          VALUES ($1, 1, 'Bermuda', NOW(), 'completed', $2, 'Match #1 Standings')
          RETURNING id
        `, [newTournamentId, isOfficialBool]);

        const matchId = mRes.rows[0]?.id;

        // Sort teams by total points descending to determine placement
        const combinedData = teamIds.map((tId: any, idx: number) => {
          const totalPts = Number(totalPtsArr[idx]) || 0;
          const kills = Number(killsArr[idx]) || 0;
          const placePts = Number(placePtsArr[idx]) || (totalPts - kills);
          const booyahs = Number(booyahsArr[idx]) || 0;
          return {
            teamId: parseInt(tId, 10),
            kills,
            placementPoints: placePts,
            totalPoints: totalPts,
            booyahs
          };
        }).sort((a: any, b: any) => b.totalPoints - a.totalPoints);

        for (let i = 0; i < combinedData.length; i++) {
          const item = combinedData[i];
          const placement = i + 1;
          await db.query(`
            INSERT INTO match_team_results (match_id, team_id, placement, kills, placement_points, kill_points, total_points, is_official)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [matchId, item.teamId, placement, item.kills, item.placementPoints, item.kills, item.totalPoints, isOfficialBool]);
        }
      }
    }

    TournamentService.invalidateCache();
    // Redirect directly into the newly created tournament's manage page so matches can be logged right away
    return adminRedirect(req, res, `/admin/tournaments/${newTournamentId}/edit?success=` + encodeURIComponent(`Tournament "${name}" created and set as active!`));
  } catch (err: any) {
    console.error('Create tournament error:', err);
    res.status(500).render('error', { message: 'Failed to create tournament: ' + err.message });
  }
});

// Edit Tournament Form
router.get('/tournaments/:id/edit', async (req: Request, res: Response) => {
  const tourneyId = parseInt(req.params.id, 10);
  const [t, teams, standings, matches, allTournaments, allPlayers] = await Promise.all([
    TournamentService.getTournamentById(tourneyId),
    TournamentService.getAllTeams(),
    TournamentService.getTournamentStandings(tourneyId, false),
    TournamentService.getTournamentMatches(tourneyId),
    TournamentService.getAllTournaments(),
    TournamentService.getAllPlayers()
  ]);
  
  if (!t) return res.status(404).render('error', { message: 'Tournament not found.' });
  
  const nextMatchNumber = matches.length > 0 ? Math.min(6, Math.max(...matches.map(m => m.match_number)) + 1) : 1;

  res.render('admin/tournament_form', {
    title: `Edit ${t.name} — Admin`,
    tournament: t,
    teams,
    standings,
    matches,
    allTournaments,
    players: allPlayers,
    nextMatchNumber
  });
});

// Update Tournament (POST)
router.post('/tournaments/:id/edit', upload.single('banner'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
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
      standings_team_id,
      standings_matches,
      standings_booyahs,
      standings_kills,
      standings_place_pts,
      standings_total_pts
    } = req.body;
    
    const existing = await TournamentService.getTournamentById(id);
    let bannerUrl = banner_url_input?.trim() || existing?.banner_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop';
    
    if (req.file) {
      const processed = await processAndUploadImage(req.file.buffer, 'tournaments', 1200, 85);
      bannerUrl = processed.url;
    }

    const isCurrentBool = is_current === 'true' || is_current === 'on';
    const isOfficialBool = is_official_tournament !== 'false';

    if (isCurrentBool) {
      await db.query('UPDATE tournaments SET is_current = FALSE');
    }

    await db.query(`
      UPDATE tournaments 
      SET name = $1, game_mode = $2, banner_url = $3, start_date = $4, end_date = $5, status = $6, is_current = $7, prize_pool = $8, description = $9
      WHERE id = $10
    `, [name, game_mode || 'Battle Royale Squad', bannerUrl, start_date || null, end_date || null, status || 'ongoing', isCurrentBool, prize_pool || '$0', description || '', id]);

    // Handle Standings Editor updates if submitted
    if (standings_team_id) {
      const teamIds = Array.isArray(standings_team_id) ? standings_team_id : [standings_team_id];
      const killsArr = Array.isArray(standings_kills) ? standings_kills : (standings_kills ? [standings_kills] : []);
      const placePtsArr = Array.isArray(standings_place_pts) ? standings_place_pts : (standings_place_pts ? [standings_place_pts] : []);
      const totalPtsArr = Array.isArray(standings_total_pts) ? standings_total_pts : (standings_total_pts ? [standings_total_pts] : []);

      const existingMatches = await TournamentService.getTournamentMatches(id);
      let matchId: number;

      if (existingMatches.length > 0) {
        matchId = existingMatches[0].id;
        // Clean out existing match results for this base match
        await db.query('DELETE FROM match_team_results WHERE match_id = $1', [matchId]);
      } else {
        const mRes = await db.query(`
          INSERT INTO matches (tournament_id, match_number, map_name, played_at, status, is_official, notes)
          VALUES ($1, 1, 'Bermuda', NOW(), 'completed', $2, 'Match #1 Standings')
          RETURNING id
        `, [id, isOfficialBool]);
        matchId = mRes.rows[0]?.id;
      }

      // Sort teams by total points descending
      const combinedData = teamIds.map((tId: any, idx: number) => {
        const totalPts = Number(totalPtsArr[idx]) || 0;
        const kills = Number(killsArr[idx]) || 0;
        const placePts = Number(placePtsArr[idx]) || (totalPts - kills);
        return {
          teamId: parseInt(tId, 10),
          kills,
          placementPoints: placePts,
          totalPoints: totalPts
        };
      }).sort((a: any, b: any) => b.totalPoints - a.totalPoints);

      for (let i = 0; i < combinedData.length; i++) {
        const item = combinedData[i];
        const placement = i + 1;
        await db.query(`
          INSERT INTO match_team_results (match_id, team_id, placement, kills, placement_points, kill_points, total_points, is_official)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [matchId, item.teamId, placement, item.kills, item.placementPoints, item.kills, item.totalPoints, isOfficialBool]);
      }
    }

    TournamentService.invalidateCache();
    return adminRedirect(req, res, '/admin/tournaments?success=' + encodeURIComponent('Tournament and Match Standings updated successfully!'));
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to update tournament: ' + err.message });
  }
});

// Set as Current Tournament
router.all('/tournaments/:id/set-current', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('UPDATE tournaments SET is_current = FALSE');
    await db.query('UPDATE tournaments SET is_current = TRUE WHERE id = $1', [id]);
    TournamentService.invalidateCache();
    return adminRedirect(req, res, '/admin/tournaments?success=' + encodeURIComponent('Featured current tournament updated.'));
  } catch (err: any) {
    return adminRedirect(req, res, '/admin/tournaments?error=' + encodeURIComponent(err.message));
  }
});

// Delete Tournament
router.all('/tournaments/:id/delete', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    // Delete matches, match_team_results, match_player_stats associated with this tournament
    await db.query(`
      DELETE FROM match_player_stats WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = $1)
    `, [id]).catch(() => {});
    await db.query(`
      DELETE FROM match_team_results WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = $1)
    `, [id]).catch(() => {});
    await db.query(`
      DELETE FROM matches WHERE tournament_id = $1
    `, [id]).catch(() => {});
    await db.query('DELETE FROM tournaments WHERE id = $1', [id]);

    TournamentService.invalidateCache();
    return adminRedirect(req, res, '/admin/tournaments?success=' + encodeURIComponent('Tournament and associated matches deleted successfully.'));
  } catch (err: any) {
    console.error('Delete tournament error:', err);
    return adminRedirect(req, res, '/admin/tournaments?error=' + encodeURIComponent('Failed to delete tournament: ' + err.message));
  }
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

// Create / Update Match (POST)
router.post('/matches/new', async (req: Request, res: Response) => {
  try {
    const { tournament_id, match_number, map_name, played_at, status, is_official, notes } = req.body;
    const isOfficialBool = is_official === 'true' || is_official === 'on' || is_official === true;
    const tourneyId = parseInt(tournament_id, 10);
    const matchNum = parseInt(match_number, 10);

    // Check if match already exists for this tournament & match_number to avoid duplicates
    let matchId: number;
    const existingMatchRes = await db.query(`
      SELECT id FROM matches WHERE tournament_id = $1 AND match_number = $2
    `, [tourneyId, matchNum]);

    if (existingMatchRes.rows.length > 0) {
      matchId = existingMatchRes.rows[0].id;
      await db.query(`
        UPDATE matches 
        SET map_name = $1, played_at = $2, status = $3, is_official = $4, notes = $5
        WHERE id = $6
      `, [
        map_name || 'Bermuda',
        played_at ? new Date(played_at) : new Date(),
        status || 'completed',
        isOfficialBool,
        notes || '',
        matchId
      ]);
      // Clear previous results for this match to re-insert fresh updated values
      await db.query('DELETE FROM match_player_stats WHERE match_id = $1', [matchId]).catch(() => {});
      await db.query('DELETE FROM match_team_results WHERE match_id = $1', [matchId]).catch(() => {});
    } else {
      // Create match entry
      const matchRes = await db.query(`
        INSERT INTO matches (tournament_id, match_number, map_name, played_at, status, is_official, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        tourneyId,
        matchNum,
        map_name || 'Bermuda',
        played_at ? new Date(played_at) : new Date(),
        status || 'completed',
        isOfficialBool,
        notes || ''
      ]);

      matchId = matchRes.rows[0]?.id || memoryDb.matches[memoryDb.matches.length - 1]?.id;
    }

    // 1. Parse and deduplicate individual player kills
    const rawPlayerIds = req.body['player_id[]'] || req.body.player_id || req.body.player_ids;
    const rawPlayerKills = req.body['player_kills[]'] || req.body.player_kills || req.body.player_kill;
    const rawPlayerDamage = req.body['player_damage[]'] || req.body.player_damage;
    const rawPlayerHeadshots = req.body['player_headshots[]'] || req.body.player_headshots;

    const playerIds = Array.isArray(rawPlayerIds) ? rawPlayerIds : (rawPlayerIds ? [rawPlayerIds] : []);
    const playerKillsArr = Array.isArray(rawPlayerKills) ? rawPlayerKills : (rawPlayerKills ? [rawPlayerKills] : []);
    const playerDamageArr = Array.isArray(rawPlayerDamage) ? rawPlayerDamage : (rawPlayerDamage ? [rawPlayerDamage] : []);
    const playerHeadshotsArr = Array.isArray(rawPlayerHeadshots) ? rawPlayerHeadshots : (rawPlayerHeadshots ? [rawPlayerHeadshots] : []);

    let sumPlayerKills = 0;
    const playerStatsToInsert: { playerId: number; kills: number; damage: number; headshots: number }[] = [];
    const seenPlayerIds = new Set<number>();

    if (playerIds.length > 0) {
      for (let p = 0; p < playerIds.length; p++) {
        const pId = parseInt(playerIds[p], 10);
        if (isNaN(pId) || seenPlayerIds.has(pId)) continue;
        seenPlayerIds.add(pId);

        const pKills = parseInt(playerKillsArr[p], 10) || 0;
        const pDamage = parseInt(playerDamageArr[p], 10) || (pKills * 220);
        const pHeadshots = parseInt(playerHeadshotsArr[p], 10) || Math.floor(pKills * 0.4);
        sumPlayerKills += pKills;
        playerStatsToInsert.push({ playerId: pId, kills: pKills, damage: pDamage, headshots: pHeadshots });
      }
    }

    // 2. Parse team results
    const rawTeamIds = req.body.team_id || req.body.team_ids;
    const rawPlacements = req.body.placement || req.body.placements;
    const rawKills = req.body.kills || req.body.kill;

    const teamIds = Array.isArray(rawTeamIds) ? rawTeamIds : (rawTeamIds ? [rawTeamIds] : ['1']);
    const placements = Array.isArray(rawPlacements) ? rawPlacements : (rawPlacements ? [rawPlacements] : ['1']);
    const killsArr = Array.isArray(rawKills) ? rawKills : (rawKills ? [rawKills] : []);

    // Clean previous records for this match
    await db.query('DELETE FROM match_player_stats WHERE match_id = $1', [matchId]).catch(() => {});
    await db.query('DELETE FROM match_team_results WHERE match_id = $1', [matchId]).catch(() => {});

    if (teamIds.length > 0) {
      for (let i = 0; i < teamIds.length; i++) {
        const teamId = parseInt(teamIds[i], 10);
        if (isNaN(teamId)) continue;
        const placement = parseInt(placements[i], 10) || (i + 1);
        
        let kills = parseInt(killsArr[i], 10);
        if (isNaN(kills) || (kills === 0 && sumPlayerKills > 0)) {
          kills = sumPlayerKills;
        } else if (sumPlayerKills > 0 && isNaN(kills)) {
          kills = sumPlayerKills;
        }
        if (isNaN(kills)) kills = 0;
        
        // Placement points: 1st=12, 2nd=9, 3rd=8, 4th=7, 5th=6, 6th=5, etc.
        const placementPoints = placement === 1 ? 12 : Math.max(0, 10 - placement);
        const totalPoints = kills + placementPoints;

        await db.query(`
          INSERT INTO match_team_results (match_id, team_id, placement, kills, placement_points, kill_points, total_points, is_official)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [matchId, teamId, placement, kills, placementPoints, kills, totalPoints, isOfficialBool]);
      }
    }

    // 3. Insert individual player stats ONCE for TAG Squad
    const primaryTeamId = parseInt(teamIds[0], 10) || 1;
    for (const ps of playerStatsToInsert) {
      await db.query(`
        INSERT INTO match_player_stats (match_id, player_id, team_id, kills, damage, headshots, survival_time_sec, is_official)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [matchId, ps.playerId, primaryTeamId, ps.kills, ps.damage, ps.headshots, 600, isOfficialBool]);
    }

    // Check total matches for this tournament to auto-archive after 6 matches
    const tourneyMatches = await TournamentService.getTournamentMatches(tourneyId);
    let extraNotice = '';
    if (tourneyMatches.length >= 6) {
      await db.query(`UPDATE tournaments SET status = 'completed' WHERE id = $1`, [tourneyId]);
      extraNotice = ' Tournament reached 6 matches and has been automatically archived into Match History!';
    }

    TournamentService.invalidateCache();
    const finalKillsRecorded = sumPlayerKills || (killsArr[0] ? parseInt(killsArr[0], 10) : 0);
    const successMsg = `Match #${match_number} saved with ${finalKillsRecorded} Team Kills (${isOfficialBool ? 'OFFICIAL' : 'UNOFFICIAL / LIVE'}).${extraNotice}`;
    const redirectTarget = req.body.redirect_to ? (req.body.redirect_to + (req.body.redirect_to.includes('?') ? '&' : '?') + 'success=' + encodeURIComponent(successMsg)) : (`/admin/matches?tournament_id=${tournament_id}&success=` + encodeURIComponent(successMsg));
    return adminRedirect(req, res, redirectTarget);
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to create match: ' + err.message });
  }
});

// Batch Create Matches 1-6 (POST)
router.post('/matches/batch', async (req: Request, res: Response) => {
  try {
    const { 
      tournament_id, 
      match_count, 
      is_official,
      match_1_map,
      match_2_map,
      match_3_map,
      match_4_map,
      match_5_map,
      match_6_map
    } = req.body;

    const tourneyId = parseInt(tournament_id, 10);
    const count = Math.min(6, Math.max(1, parseInt(match_count, 10) || 6));
    const isOfficialBool = is_official === 'true' || is_official === 'on' || is_official === true;

    // Get current match count to number appropriately
    const existingMatches = await TournamentService.getTournamentMatches(tourneyId);
    const startMatchNumber = existingMatches.length > 0 ? Math.max(...existingMatches.map(m => m.match_number)) + 1 : 1;

    const mapSelections = [
      match_1_map || 'Bermuda',
      match_2_map || 'Purgatory',
      match_3_map || 'Kalahari',
      match_4_map || 'Alpine',
      match_5_map || 'Nexterra',
      match_6_map || 'Random'
    ];

    const matchConfigs = [];
    for (let i = 0; i < count; i++) {
      const matchNum = startMatchNumber + i;
      const rawMap = mapSelections[i] || 'Bermuda';
      const mapName = resolveMapName(rawMap);
      matchConfigs.push({
        match_number: matchNum,
        map_name: mapName,
        is_official: isOfficialBool,
        notes: `Match #${matchNum} • ${mapName} Rotation${rawMap === 'Random' ? ' (Random Map)' : ''}`
      });
    }

    // Auto-save batch matches into database and history
    await TournamentService.createBatchMatches(tourneyId, matchConfigs);

    return adminRedirect(req, res, `/admin/matches?tournament_id=${tourneyId}&success=` + encodeURIComponent(`Successfully created and archived ${count} matches (Matches #${startMatchNumber} to #${startMatchNumber + count - 1}) into History!`));
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to batch create matches: ' + err.message });
  }
});

// Toggle Match Official Status (Locks in or unlocks)
router.all('/matches/:id/toggle-official', async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.id, 10);
    const targetOfficial = req.body?.is_official === 'true' || req.body?.is_official === true || req.query?.is_official === 'true';
    
    await db.query('UPDATE matches SET is_official = $1 WHERE id = $2', [targetOfficial, matchId]);
    await db.query('UPDATE match_team_results SET is_official = $1 WHERE match_id = $2', [targetOfficial, matchId]);
    await db.query('UPDATE match_player_stats SET is_official = $1 WHERE match_id = $2', [targetOfficial, matchId]);

    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ success: true, is_official: targetOfficial });
    }

    return adminRedirect(req, res, '/admin/matches');
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Match
router.all('/matches/:id/delete', async (req: Request, res: Response) => {
  const matchId = parseInt(req.params.id, 10);
  try {
    await db.query('DELETE FROM match_player_stats WHERE match_id = $1', [matchId]).catch(() => {});
    await db.query('DELETE FROM match_team_results WHERE match_id = $1', [matchId]).catch(() => {});
    await db.query('DELETE FROM matches WHERE id = $1', [matchId]);
    TournamentService.invalidateCache();
    return adminRedirect(req, res, '/admin/matches?success=' + encodeURIComponent('Match deleted.'));
  } catch (err: any) {
    return adminRedirect(req, res, '/admin/matches?error=' + encodeURIComponent(err.message));
  }
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

// GET fallback for teams edit/new
router.get('/teams/:id/edit', (req: Request, res: Response) => {
  return adminRedirect(req, res, '/admin/teams');
});

router.get('/teams/new', (req: Request, res: Response) => {
  return adminRedirect(req, res, '/admin/teams');
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
    return adminRedirect(req, res, '/admin/teams?success=' + encodeURIComponent(`Team ${name} registered successfully!`));
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
      return adminRedirect(req, res, '/admin/teams?error=' + encodeURIComponent('No image provided.'));
    }

    await db.query(`UPDATE teams SET logo_url = $1 WHERE id = $2`, [logoUrl, id]);
    TournamentService.invalidateCache();

    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.xhr) {
      return res.json({ success: true, logo_url: logoUrl, message: 'Logo updated successfully!' });
    }

    const redirectUrl = req.body.redirect_to || ('/admin/teams?success=' + encodeURIComponent('Team logo updated successfully!'));
    return adminRedirect(req, res, redirectUrl);
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to update team logo: ' + err.message });
  }
});

router.all('/teams/:id/delete', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.query('DELETE FROM teams WHERE id = $1', [id]);
    TournamentService.invalidateCache();
    return adminRedirect(req, res, '/admin/teams?success=' + encodeURIComponent('Team removed.'));
  } catch (err: any) {
    return adminRedirect(req, res, '/admin/teams?error=' + encodeURIComponent(err.message));
  }
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

// GET /players/:id/edit - Redirect or serve edit page smoothly
router.get('/players/:id/edit', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const players = await TournamentService.getAllPlayers();
  const teams = await TournamentService.getAllTeams();
  const targetPlayer = await TournamentService.getPlayerStats(id);

  res.render('admin/players', {
    title: 'Player Roster Management — Admin',
    players,
    teams,
    openEditId: id,
    targetPlayer,
    success: req.query.success as string || null,
    error: req.query.error as string || null
  });
});

// GET /players/new - Redirect to roster page
router.get('/players/new', (req: Request, res: Response) => {
  return adminRedirect(req, res, '/admin/players');
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
    return adminRedirect(req, res, '/admin/players?success=' + encodeURIComponent(`Player ${in_game_name} created successfully!`));
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

router.all('/players/:id/delete', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.query('DELETE FROM players WHERE id = $1', [id]);
    TournamentService.invalidateCache();
    return adminRedirect(req, res, '/admin/players?success=' + encodeURIComponent('Player removed.'));
  } catch (err: any) {
    return adminRedirect(req, res, '/admin/players?error=' + encodeURIComponent(err.message));
  }
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
      return adminRedirect(req, res, '/admin/settings?success=' + encodeURIComponent('Site background image updated and compressed successfully!'));
    }
    
    if (req.body.background_url) {
      await TournamentService.updateSiteSetting('site_background_url', req.body.background_url);
      return adminRedirect(req, res, '/admin/settings?success=' + encodeURIComponent('Site background URL saved!'));
    }

    return adminRedirect(req, res, '/admin/settings');
  } catch (err: any) {
    res.status(500).render('error', { message: 'Failed to update background: ' + err.message });
  }
});

router.post('/settings/general', async (req: Request, res: Response) => {
  const { site_title, site_tagline } = req.body;
  if (site_title) await TournamentService.updateSiteSetting('site_title', site_title);
  if (site_tagline) await TournamentService.updateSiteSetting('site_tagline', site_tagline);
  return adminRedirect(req, res, '/admin/settings?success=' + encodeURIComponent('General settings saved!'));
});

// Reset Website Data (Clears all tournaments, matches, and stats to 0)
router.all('/settings/reset-database', async (req: Request, res: Response) => {
  try {
    await resetAllWebsiteData();
    TournamentService.invalidateCache();
    return adminRedirect(req, res, '/admin/settings?success=' + encodeURIComponent('Website data successfully reset to 0! All tournaments and matches cleared.'));
  } catch (err: any) {
    console.error('Reset database error:', err);
    res.status(500).render('error', { message: 'Failed to reset database: ' + err.message });
  }
});

export default router;
