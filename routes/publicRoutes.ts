import { Router, Request, Response } from 'express';
import { TournamentService } from '../services/tournamentService.js';

const router = Router();

// Middleware to inject site settings and current path into all views
router.use(async (req: Request, res: Response, next) => {
  try {
    const settings = await TournamentService.getSiteSettings();
    res.locals.settings = settings;
    res.locals.currentPath = req.path;
    res.locals.isAdmin = Boolean(req.session && (req.session as any).isAdmin);
    next();
  } catch (e) {
    next();
  }
});

// 1. Homepage: Current Featured Tournament + Standings + Live Feed
router.get('/', async (req: Request, res: Response) => {
  try {
    const [currentTournament, allTournaments, careerSummary, allPlayerStats] = await Promise.all([
      TournamentService.getCurrentTournament(),
      TournamentService.getAllTournaments(),
      TournamentService.getCareerSummary(),
      TournamentService.getAllPlayerStatsSummaries()
    ]);

    let standingsOfficial: any[] = [];
    let standingsUnofficial: any[] = [];
    let matches: any[] = [];
    let currentTourneySummary: any = null;

    if (currentTournament) {
      [standingsOfficial, standingsUnofficial, matches, currentTourneySummary] = await Promise.all([
        TournamentService.getTournamentStandings(currentTournament.id, true),
        TournamentService.getTournamentStandings(currentTournament.id, false),
        TournamentService.getTournamentMatches(currentTournament.id),
        TournamentService.getTournamentSummary(currentTournament.id)
      ]);
    }
    
    const topPlayersOfficial = [...allPlayerStats].sort((a, b) => b.official.kills - a.official.kills).slice(0, 5);
    const topPlayersUnofficial = [...allPlayerStats].sort((a, b) => b.unofficial.kills - a.unofficial.kills).slice(0, 5);
    const topPlayersCombined = [...allPlayerStats].sort((a, b) => b.combined.kills - a.combined.kills).slice(0, 5);

    const officialMatches = matches.filter(m => m.is_official);
    const unofficialMatches = matches.filter(m => !m.is_official);
    const hasAnyUnofficialMatch = unofficialMatches.length > 0;

    // Calculate map distribution & match details for the current tournament
    const mapStats: { [name: string]: { name: string; count: number; officialCount: number; unofficialCount: number; booyahs: number; kills: number } } = {};
    matches.forEach(m => {
      const mapName = m.map_name || 'Bermuda';
      if (!mapStats[mapName]) {
        mapStats[mapName] = { name: mapName, count: 0, officialCount: 0, unofficialCount: 0, booyahs: 0, kills: 0 };
      }
      mapStats[mapName].count++;
      if (m.is_official) mapStats[mapName].officialCount++;
      else mapStats[mapName].unofficialCount++;

      const tagRes = m.results?.find((r: any) => r.team_tag === 'TAG' || (r.team_name && r.team_name.includes('TAG')));
      if (tagRes) {
        if (tagRes.placement === 1) mapStats[mapName].booyahs++;
        mapStats[mapName].kills += Number(tagRes.kills) || 0;
      }
    });

    const mapList = Object.values(mapStats);

    res.render('home', {
      title: 'TAGFREEFIREMAX — Official Esports Tracker',
      currentTournament,
      allTournaments,
      currentTourneySummary,
      careerSummary,
      standingsOfficial,
      standingsUnofficial,
      matches,
      officialMatches,
      unofficialMatches,
      topPlayers: topPlayersCombined,
      topPlayersOfficial,
      topPlayersUnofficial,
      topPlayersCombined,
      allPlayerStats,
      hasAnyUnofficialMatch,
      mapList
    });
  } catch (err: any) {
    console.error('Home route error:', err);
    res.status(500).render('error', { message: 'Failed to load tournament data: ' + err.message });
  }
});

// 2. Tournament History & Archives
router.get('/tournaments', async (req: Request, res: Response) => {
  try {
    const tournaments = await TournamentService.getAllTournaments();
    res.render('tournaments', {
      title: 'Tournament Archives & History — TAGFREEFIREMAX',
      tournaments
    });
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// 3. Tournament Details Page
router.get('/tournament/:id', async (req: Request, res: Response) => {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const tournament = await TournamentService.getTournamentById(tournamentId);
    if (!tournament) {
      return res.status(404).render('error', { message: 'Tournament not found.' });
    }

    const viewMode = (req.query.mode as string) || 'combined'; // 'official' or 'combined'
    const isOfficialOnly = viewMode === 'official';

    const [standings, matches, tournamentSummary] = await Promise.all([
      TournamentService.getTournamentStandings(tournamentId, isOfficialOnly),
      TournamentService.getTournamentMatches(tournamentId),
      TournamentService.getTournamentSummary(tournamentId)
    ]);

    const hasUnofficial = matches.some(m => !m.is_official);

    res.render('tournament_detail', {
      title: `${tournament.name} — TAGFREEFIREMAX`,
      tournament,
      tournamentSummary,
      standings,
      matches,
      isOfficialOnly,
      hasUnofficial
    });
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// 4. Teams & Player Cards Roster
router.get('/teams', async (req: Request, res: Response) => {
  try {
    const [teams, playerSummaries, careerSummary] = await Promise.all([
      TournamentService.getAllTeams(),
      TournamentService.getAllPlayerStatsSummaries(),
      TournamentService.getCareerSummary()
    ]);

    // Group players by team
    const teamsWithRoster = teams.map(tm => {
      const roster = playerSummaries.filter(p => p.team_id === tm.id);
      return { ...tm, roster };
    });

    res.render('teams', {
      title: 'Teams & Player Cards — TAGFREEFIREMAX',
      teams: teamsWithRoster,
      allPlayers: playerSummaries,
      careerSummary
    });
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// 5. Team Details Page
router.get('/team/:id', async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const [team, allPlayerStats, careerSummary] = await Promise.all([
      TournamentService.getTeamById(teamId),
      TournamentService.getAllPlayerStatsSummaries(),
      TournamentService.getCareerSummary()
    ]);

    if (!team) {
      return res.status(404).render('error', { message: 'Team not found.' });
    }

    const rosterStats = allPlayerStats.filter(p => p.team_id === teamId);

    res.render('team_detail', {
      title: `${team.name} (${team.tag}) — Team Roster & Stats`,
      team,
      roster: rosterStats,
      careerSummary
    });
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// 6. Player Card Details Page
router.get('/player/:id', async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const playerStats = await TournamentService.getPlayerStats(playerId);
    if (!playerStats) {
      return res.status(404).render('error', { message: 'Player card not found.' });
    }

    res.render('player_detail', {
      title: `${playerStats.in_game_name} — Player Stats & Career`,
      player: playerStats
    });
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// 7. Overall Analysis Dashboard (Official Stats Only vs Include Unofficial Stats)
router.get('/analysis', async (req: Request, res: Response) => {
  try {
    const officialOnly = req.query.filter === 'official';
    const analysis = await TournamentService.getOverallAnalysis(officialOnly);

    res.render('analysis', {
      title: 'Overall Esports Analysis & Meta Trends — TAGFREEFIREMAX',
      analysis,
      officialOnly
    });
  } catch (err: any) {
    res.status(500).render('error', { message: err.message });
  }
});

// AJAX API Endpoint for instant dynamic stats switching
router.get('/api/analysis', async (req: Request, res: Response) => {
  try {
    const officialOnly = req.query.filter === 'official';
    const analysis = await TournamentService.getOverallAnalysis(officialOnly);
    res.json({ success: true, analysis });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
