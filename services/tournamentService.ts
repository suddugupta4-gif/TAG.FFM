import { db, memoryDb, isPostgresActive } from '../config/db.js';

export interface StandingsRow {
  team_id: number;
  team_name: string;
  team_tag: string;
  team_logo: string;
  matches_played: number;
  booyahs: number; // 1st placements
  kill_points: number;
  placement_points: number;
  total_points: number;
  total_kills: number;
  is_official: boolean;
  has_unofficial_matches: boolean;
}

export const ALL_FREE_FIRE_MAPS = [
  'Bermuda',
  'Purgatory',
  'Kalahari',
  'Alpine',
  'Nexterra',
  'Bermuda Remastered',
  'Solaria'
];

export const MAP_METADATA: { [key: string]: { description: string; banner: string; color: string } } = {
  'Bermuda': {
    description: 'The iconic battleground featuring Clock Tower, Peak, and Mill.',
    banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop',
    color: 'from-orange-500/20 to-red-600/10 border-orange-500/30'
  },
  'Purgatory': {
    description: 'Lush island terrain with vast open fields, bridges, and Brasilia.',
    banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
    color: 'from-emerald-500/20 to-teal-600/10 border-emerald-500/30'
  },
  'Kalahari': {
    description: 'High-intensity desert canyon warfare featuring Command Post and Refinery.',
    banner: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=600&auto=format&fit=crop',
    color: 'from-amber-500/20 to-yellow-600/10 border-amber-500/30'
  },
  'Alpine': {
    description: 'Snowy high-altitude peaks, cable car stations, and Snowfall outposts.',
    banner: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600&auto=format&fit=crop',
    color: 'from-cyan-500/20 to-blue-600/10 border-cyan-500/30'
  },
  'Nexterra': {
    description: 'Futuristic battleground with anti-gravity Grav Labs and Deca Square.',
    banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop',
    color: 'from-purple-500/20 to-indigo-600/10 border-purple-500/30'
  },
  'Bermuda Remastered': {
    description: 'Next-gen remastered edition featuring Nurek Dam and Samurai Garden.',
    banner: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?q=80&w=600&auto=format&fit=crop',
    color: 'from-rose-500/20 to-pink-600/10 border-rose-500/30'
  },
  'Solaria': {
    description: 'High-tech solar facility and modern tactical battle arena.',
    banner: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop',
    color: 'from-amber-600/20 to-orange-700/10 border-amber-600/30'
  }
};

export interface MapStatDetail {
  map_name: string;
  display_name: string;
  description: string;
  banner_url: string;
  color: string;
  matches_played: number;
  official_matches: number;
  unofficial_matches: number;
  total_kills: number;
  tag_matches: number;
  tag_kills: number;
  tag_booyahs: number;
  tag_kd: string;
  tag_avg_kills: string;
  tag_win_rate: string;
  tag_total_points: number;
  top_team: { name: string; tag: string; kills: number; booyahs: number; points: number } | null;
  top_player: { name: string; kills: number; team_tag: string; avatar_url: string } | null;
}

export interface PlayerStatsSummary {
  player_id: number;
  player_name: string;
  in_game_name: string;
  team_id: number;
  team_name: string;
  team_tag: string;
  team_logo: string;
  role: string;
  avatar_url: string;
  free_fire_uid: string;
  official: {
    matches_played: number;
    kills: number;
    total_points: number;
    avg_placement: number;
    damage: number;
    headshots: number;
    avg_kills: number;
    avg_damage: number;
    top_kills_match: number;
    has_stats: boolean;
  };
  unofficial: {
    matches_played: number;
    kills: number;
    total_points: number;
    avg_placement: number;
    damage: number;
    headshots: number;
    avg_kills: number;
    avg_damage: number;
    top_kills_match: number;
    has_stats: boolean;
  };
  combined: {
    matches_played: number;
    kills: number;
    total_points: number;
    avg_placement: number;
    damage: number;
    headshots: number;
    avg_kills: number;
    avg_damage: number;
  };
}

export interface TournamentSummaryStats {
  tournament_id: number;
  tournament_name: string;
  total_matches: number;
  official_matches: number;
  unofficial_matches: number;
  has_unofficial: boolean;
  official: {
    matches: number;
    kills: number;
    booyahs: number;
    kd: string;
    avg_kills: string;
    points: number;
    win_rate: string;
  };
  unofficial: {
    matches: number;
    kills: number;
    booyahs: number;
    kd: string;
    avg_kills: string;
    points: number;
    win_rate: string;
  };
  combined: {
    matches: number;
    kills: number;
    booyahs: number;
    kd: string;
    avg_kills: string;
    points: number;
    win_rate: string;
  };
}

export interface CareerSummaryStats {
  total_tournaments: number;
  official: {
    tournaments_played: number;
    total_matches: number;
    total_kills: number;
    total_booyahs: number;
    total_kd: string;
    avg_kills: string;
    total_points: number;
    win_rate: string;
  };
  unofficial: {
    tournaments_played: number;
    total_matches: number;
    total_kills: number;
    total_booyahs: number;
    total_kd: string;
    avg_kills: string;
    total_points: number;
    win_rate: string;
  };
  combined: {
    tournaments_played: number;
    total_matches: number;
    total_kills: number;
    total_booyahs: number;
    total_kd: string;
    avg_kills: string;
    total_points: number;
    win_rate: string;
  };
}

// Ultra-fast In-Memory Cache Store with TTL and Auto-Invalidation
interface CacheEntry<T> {
  data: T;
  expiry: number;
}
const cacheStore = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL_MS = 15000; // 15 seconds warm cache for instant response

async function getOrSetCache<T>(key: string, fetchFn: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const cached = cacheStore.get(key);
  if (cached && cached.expiry > now) {
    return cached.data;
  }
  const fresh = await fetchFn();
  cacheStore.set(key, { data: fresh, expiry: now + ttlMs });
  return fresh;
}

export class TournamentService {
  // Invalidate cache on any mutation
  static invalidateCache(pattern?: string) {
    if (!pattern) {
      cacheStore.clear();
      return;
    }
    for (const key of cacheStore.keys()) {
      if (key.includes(pattern)) {
        cacheStore.delete(key);
      }
    }
  }

  // Get site settings with high performance caching
  static async getSiteSettings() {
    return getOrSetCache('site_settings', async () => {
      try {
        const res = await db.query('SELECT key, value FROM site_settings');
        const settings: { [key: string]: string } = {
          site_background_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop',
          site_title: 'TAGFREEFIREMAX',
          site_tagline: 'Premier Free Fire MAX Esports Hub'
        };
        res.rows.forEach(r => {
          settings[r.key] = r.value;
        });
        return settings;
      } catch (e) {
        return {
          site_background_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop',
          site_title: 'TAGFREEFIREMAX',
          site_tagline: 'Premier Free Fire MAX Esports Hub'
        };
      }
    }, 60000);
  }

  static async updateSiteSetting(key: string, value: string) {
    await db.query(`
      INSERT INTO site_settings (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [key, value]);
    this.invalidateCache('site_settings');
  }

  // Get current featured tournament
  static async getCurrentTournament() {
    return getOrSetCache('current_tournament', async () => {
      const res = await db.query('SELECT * FROM tournaments WHERE is_current = TRUE LIMIT 1');
      if (res.rows.length > 0) return res.rows[0];
      const all = await db.query('SELECT * FROM tournaments ORDER BY id DESC LIMIT 1');
      return all.rows[0] || null;
    }, 10000);
  }

  // Get all tournaments
  static async getAllTournaments() {
    return getOrSetCache('all_tournaments', async () => {
      const res = await db.query('SELECT * FROM tournaments ORDER BY is_current DESC, id DESC');
      return res.rows;
    }, 10000);
  }

  // Get tournament by ID
  static async getTournamentById(id: number) {
    return getOrSetCache(`tournament_${id}`, async () => {
      const res = await db.query('SELECT * FROM tournaments WHERE id = $1', [id]);
      return res.rows[0] || null;
    }, 10000);
  }

  // Get tournament matches with their team results in a single batch query
  static async getTournamentMatches(tournamentId: number) {
    return getOrSetCache(`tournament_matches_${tournamentId}`, async () => {
      let matches: any[] = [];
      if (isPostgresActive) {
        const matchRes = await db.query(
          'SELECT * FROM matches WHERE tournament_id = $1 ORDER BY match_number ASC',
          [tournamentId]
        );
        matches = matchRes.rows;

        if (matches.length > 0) {
          const matchIds = matches.map(m => m.id);
          const resultsRes = await db.query(`
            SELECT r.*, t.name as team_name, t.tag as team_tag, t.logo_url as team_logo
            FROM match_team_results r
            JOIN teams t ON t.id = r.team_id
            WHERE r.match_id = ANY($1::int[])
            ORDER BY r.placement ASC
          `, [matchIds]);

          const resultsByMatch: { [matchId: number]: any[] } = {};
          resultsRes.rows.forEach(r => {
            if (!resultsByMatch[r.match_id]) resultsByMatch[r.match_id] = [];
            resultsByMatch[r.match_id].push(r);
          });

          matches.forEach(m => {
            m.results = resultsByMatch[m.id] || [];
          });
        }
      } else {
        matches = memoryDb.matches
          .filter(m => m.tournament_id === tournamentId)
          .sort((a, b) => a.match_number - b.match_number)
          .map(m => {
            const results = memoryDb.match_team_results
              .filter(r => r.match_id === m.id)
              .map(r => {
                const tm = memoryDb.teams.find(t => t.id === r.team_id);
                return { ...r, team_name: tm?.name, team_tag: tm?.tag, team_logo: tm?.logo_url };
              })
              .sort((a, b) => a.placement - b.placement);
            return { ...m, results };
          });
      }
      return matches;
    }, 10000);
  }

  // Aggregated summary stats for a single tournament
  static async getTournamentSummary(tournamentId: number): Promise<TournamentSummaryStats> {
    return getOrSetCache(`tournament_summary_${tournamentId}`, async () => {
      const [tournament, matches, teams] = await Promise.all([
        this.getTournamentById(tournamentId),
        this.getTournamentMatches(tournamentId),
        this.getAllTeams()
      ]);

      const tagTeam = teams.find(t => t.tag === 'TAG' || t.name.includes('TAG')) || teams[0];
      const tagTeamId = tagTeam?.id || 1;

      let officialMatchesCount = 0;
      let unofficialMatchesCount = 0;

      let officialStats = { matches: 0, kills: 0, booyahs: 0, points: 0 };
      let unofficialStats = { matches: 0, kills: 0, booyahs: 0, points: 0 };
      let combinedStats = { matches: 0, kills: 0, booyahs: 0, points: 0 };

      for (const m of matches) {
        const isOfficial = m.is_official === true;
        if (isOfficial) {
          officialMatchesCount++;
        } else {
          unofficialMatchesCount++;
        }

        const tagResult = m.results?.find((r: any) => r.team_id === tagTeamId || r.team_tag === 'TAG');
        if (tagResult) {
          const kills = Number(tagResult.kills) || 0;
          const pts = Number(tagResult.total_points) || (kills + (tagResult.placement === 1 ? 12 : Math.max(0, 10 - tagResult.placement)));
          const isBooyah = tagResult.placement === 1;

          combinedStats.matches++;
          combinedStats.kills += kills;
          if (isBooyah) combinedStats.booyahs++;
          combinedStats.points += pts;

          if (isOfficial && tagResult.is_official !== false) {
            officialStats.matches++;
            officialStats.kills += kills;
            if (isBooyah) officialStats.booyahs++;
            officialStats.points += pts;
          } else {
            unofficialStats.matches++;
            unofficialStats.kills += kills;
            if (isBooyah) unofficialStats.booyahs++;
            unofficialStats.points += pts;
          }
        }
      }

      if (combinedStats.matches === 0 && matches.length > 0) {
        combinedStats.matches = matches.length;
        officialStats.matches = officialMatchesCount;
        unofficialStats.matches = unofficialMatchesCount;
      }

      const officialDeaths = Math.max(1, officialStats.matches - officialStats.booyahs);
      const unofficialDeaths = Math.max(1, unofficialStats.matches - unofficialStats.booyahs);
      const combinedDeaths = Math.max(1, combinedStats.matches - combinedStats.booyahs);

      const officialKd = officialStats.matches > 0 ? (officialStats.kills / officialDeaths).toFixed(2) : '0.00';
      const unofficialKd = unofficialStats.matches > 0 ? (unofficialStats.kills / unofficialDeaths).toFixed(2) : '0.00';
      const combinedKd = combinedStats.matches > 0 ? (combinedStats.kills / combinedDeaths).toFixed(2) : '0.00';

      const officialAvgKills = officialStats.matches > 0 ? (officialStats.kills / officialStats.matches).toFixed(1) : '0.0';
      const unofficialAvgKills = unofficialStats.matches > 0 ? (unofficialStats.kills / unofficialStats.matches).toFixed(1) : '0.0';
      const combinedAvgKills = combinedStats.matches > 0 ? (combinedStats.kills / combinedStats.matches).toFixed(1) : '0.0';

      const officialWinRate = officialStats.matches > 0 ? ((officialStats.booyahs / officialStats.matches) * 100).toFixed(1) : '0.0';
      const unofficialWinRate = unofficialStats.matches > 0 ? ((unofficialStats.booyahs / unofficialStats.matches) * 100).toFixed(1) : '0.0';
      const combinedWinRate = combinedStats.matches > 0 ? ((combinedStats.booyahs / combinedStats.matches) * 100).toFixed(1) : '0.0';

      return {
        tournament_id: tournamentId,
        tournament_name: tournament?.name || 'Tournament',
        total_matches: matches.length,
        official_matches: officialMatchesCount,
        unofficial_matches: unofficialMatchesCount,
        has_unofficial: unofficialMatchesCount > 0,
        official: {
          matches: officialStats.matches,
          kills: officialStats.kills,
          booyahs: officialStats.booyahs,
          kd: officialKd,
          avg_kills: officialAvgKills,
          points: officialStats.points,
          win_rate: officialWinRate
        },
        unofficial: {
          matches: unofficialStats.matches,
          kills: unofficialStats.kills,
          booyahs: unofficialStats.booyahs,
          kd: unofficialKd,
          avg_kills: unofficialAvgKills,
          points: unofficialStats.points,
          win_rate: unofficialWinRate
        },
        combined: {
          matches: combinedStats.matches,
          kills: combinedStats.kills,
          booyahs: combinedStats.booyahs,
          kd: combinedKd,
          avg_kills: combinedAvgKills,
          points: combinedStats.points,
          win_rate: combinedWinRate
        }
      };
    }, 10000);
  }

  // Career aggregate across ALL tournaments and matches for TAG squad
  static async getCareerSummary(): Promise<CareerSummaryStats> {
    return getOrSetCache('career_summary', async () => {
      const [tournaments, teams] = await Promise.all([
        this.getAllTournaments(),
        this.getAllTeams()
      ]);
      const tagTeam = teams.find(t => t.tag === 'TAG' || t.name.includes('TAG')) || teams[0];
      const tagTeamId = tagTeam?.id || 1;

      let allMatches: any[] = [];
      if (isPostgresActive) {
        const res = await db.query(`
          SELECT m.*, r.placement, r.kills, r.total_points, r.is_official as result_is_official
          FROM matches m
          LEFT JOIN match_team_results r ON r.match_id = m.id AND r.team_id = $1
          ORDER BY m.played_at ASC
        `, [tagTeamId]);
        allMatches = res.rows;
      } else {
        allMatches = memoryDb.matches.map(m => {
          const r = memoryDb.match_team_results.find(res => res.match_id === m.id && res.team_id === tagTeamId);
          return {
            ...m,
            placement: r?.placement,
            kills: r?.kills,
            total_points: r?.total_points,
            result_is_official: r?.is_official
          };
        });
      }

      const official = {
        tournaments_played: 0,
        total_matches: 0,
        total_kills: 0,
        total_booyahs: 0,
        total_kd: '0.00',
        avg_kills: '0.0',
        total_points: 0,
        win_rate: '0.0'
      };

      const unofficial = {
        tournaments_played: 0,
        total_matches: 0,
        total_kills: 0,
        total_booyahs: 0,
        total_kd: '0.00',
        avg_kills: '0.0',
        total_points: 0,
        win_rate: '0.0'
      };

      const combined = {
        tournaments_played: tournaments.length,
        total_matches: 0,
        total_kills: 0,
        total_booyahs: 0,
        total_kd: '0.00',
        avg_kills: '0.0',
        total_points: 0,
        win_rate: '0.0'
      };

      const officialTourneySet = new Set<number>();
      const unofficialTourneySet = new Set<number>();
      const combinedTourneySet = new Set<number>();

      for (const m of allMatches) {
        const kills = Number(m.kills) || 0;
        const pts = Number(m.total_points) || (kills + (m.placement === 1 ? 12 : Math.max(0, 10 - (m.placement || 12))));
        const isBooyah = m.placement === 1;
        const isOfficial = m.is_official === true && m.result_is_official !== false;

        combined.total_matches++;
        combined.total_kills += kills;
        if (isBooyah) combined.total_booyahs++;
        combined.total_points += pts;
        combinedTourneySet.add(m.tournament_id);

        if (isOfficial) {
          official.total_matches++;
          official.total_kills += kills;
          if (isBooyah) official.total_booyahs++;
          official.total_points += pts;
          officialTourneySet.add(m.tournament_id);
        } else {
          unofficial.total_matches++;
          unofficial.total_kills += kills;
          if (isBooyah) unofficial.total_booyahs++;
          unofficial.total_points += pts;
          unofficialTourneySet.add(m.tournament_id);
        }
      }

      official.tournaments_played = officialTourneySet.size;
      unofficial.tournaments_played = unofficialTourneySet.size;
      combined.tournaments_played = combinedTourneySet.size || tournaments.length;

      const officialDeaths = Math.max(1, official.total_matches - official.total_booyahs);
      const unofficialDeaths = Math.max(1, unofficial.total_matches - unofficial.total_booyahs);
      const combinedDeaths = Math.max(1, combined.total_matches - combined.total_booyahs);

      if (official.total_matches > 0) {
        official.total_kd = (official.total_kills / officialDeaths).toFixed(2);
        official.avg_kills = (official.total_kills / official.total_matches).toFixed(1);
        official.win_rate = ((official.total_booyahs / official.total_matches) * 100).toFixed(1);
      }

      if (unofficial.total_matches > 0) {
        unofficial.total_kd = (unofficial.total_kills / unofficialDeaths).toFixed(2);
        unofficial.avg_kills = (unofficial.total_kills / unofficial.total_matches).toFixed(1);
        unofficial.win_rate = ((unofficial.total_booyahs / unofficial.total_matches) * 100).toFixed(1);
      }

      if (combined.total_matches > 0) {
        combined.total_kd = (combined.total_kills / combinedDeaths).toFixed(2);
        combined.avg_kills = (combined.total_kills / combined.total_matches).toFixed(1);
        combined.win_rate = ((combined.total_booyahs / combined.total_matches) * 100).toFixed(1);
      }

      return {
        total_tournaments: tournaments.length,
        official,
        unofficial,
        combined
      };
    }, 10000);
  }

  // Calculate Standings for a tournament (supports official_only filter)
  static async getTournamentStandings(tournamentId: number, officialOnly: boolean = false): Promise<StandingsRow[]> {
    const cacheKey = `standings_${tournamentId}_${officialOnly}`;
    return getOrSetCache(cacheKey, async () => {
      const [matches, teams] = await Promise.all([
        this.getTournamentMatches(tournamentId),
        this.getAllTeams()
      ]);

      const standingsMap: { [teamId: number]: StandingsRow } = {};

      teams.forEach(tm => {
        standingsMap[tm.id] = {
          team_id: tm.id,
          team_name: tm.name,
          team_tag: tm.tag,
          team_logo: tm.logo_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&auto=format&fit=crop',
          matches_played: 0,
          booyahs: 0,
          kill_points: 0,
          placement_points: 0,
          total_points: 0,
          total_kills: 0,
          is_official: true,
          has_unofficial_matches: false
        };
      });

      for (const match of matches) {
        if (officialOnly && !match.is_official) {
          continue;
        }

        if (!match.results || match.results.length === 0) continue;

        for (const res of match.results) {
          if (officialOnly && !res.is_official) continue;

          const row = standingsMap[res.team_id];
          if (row) {
            row.matches_played += 1;
            if (res.placement === 1) {
              row.booyahs += 1;
            }
            const kills = Number(res.kills) || 0;
            const kPoints = Number(res.kill_points) || kills;
            const pPoints = Number(res.placement_points) || (res.placement === 1 ? 12 : Math.max(1, 10 - res.placement));
            const tPoints = Number(res.total_points) || (kPoints + pPoints);

            row.total_kills += kills;
            row.kill_points += kPoints;
            row.placement_points += pPoints;
            row.total_points += tPoints;

            if (!res.is_official || !match.is_official) {
              row.has_unofficial_matches = true;
            }
          }
        }
      }

      const list = Object.values(standingsMap);
      list.sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points;
        if (b.booyahs !== a.booyahs) return b.booyahs - a.booyahs;
        return b.total_kills - a.total_kills;
      });

      return list;
    }, 10000);
  }

  // Get all teams
  static async getAllTeams() {
    return getOrSetCache('all_teams', async () => {
      if (isPostgresActive) {
        const res = await db.query('SELECT * FROM teams ORDER BY name ASC');
        return res.rows;
      }
      return [...memoryDb.teams].sort((a, b) => a.name.localeCompare(b.name));
    }, 20000);
  }

  // Get team by ID with roster
  static async getTeamById(id: number) {
    return getOrSetCache(`team_${id}`, async () => {
      if (isPostgresActive) {
        const res = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
        const team = res.rows[0];
        if (team) {
          const playersRes = await db.query('SELECT * FROM players WHERE team_id = $1 ORDER BY name ASC', [id]);
          team.players = playersRes.rows;
        }
        return team || null;
      }
      const team = memoryDb.teams.find(t => t.id === id);
      if (team) {
        return {
          ...team,
          players: memoryDb.players.filter(p => p.team_id === id)
        };
      }
      return null;
    }, 15000);
  }

  // Get all players
  static async getAllPlayers() {
    return getOrSetCache('all_players', async () => {
      if (isPostgresActive) {
        const res = await db.query(`
          SELECT p.*, t.name as team_name, t.tag as team_tag, t.logo_url as team_logo
          FROM players p
          LEFT JOIN teams t ON t.id = p.team_id
          ORDER BY p.name ASC
        `);
        return res.rows;
      }
      return memoryDb.players.map(p => {
        const t = memoryDb.teams.find(tm => tm.id === p.team_id);
        return { ...p, team_name: t?.name, team_tag: t?.tag, team_logo: t?.logo_url };
      });
    }, 15000);
  }

  // Get aggregated stats across ALL players in a SINGLE bulk query (eliminates N+1 DB roundtrips)
  static async getAllPlayerStatsSummaries(): Promise<PlayerStatsSummary[]> {
    return getOrSetCache('all_player_stats_summaries', async () => {
      const players = await this.getAllPlayers();
      if (players.length === 0) return [];

      let allStatsRows: any[] = [];
      if (isPostgresActive) {
        const sRes = await db.query(`
          SELECT 
            mps.*,
            COALESCE(mtr.placement, 12) as match_placement,
            COALESCE(mtr.placement_points, 0) as match_placement_points
          FROM match_player_stats mps
          LEFT JOIN match_team_results mtr ON mtr.match_id = mps.match_id AND mtr.team_id = mps.team_id
        `);
        allStatsRows = sRes.rows;
      } else {
        allStatsRows = memoryDb.match_player_stats.map(s => {
          const tr = memoryDb.match_team_results.find(r => r.match_id === s.match_id && r.team_id === s.team_id);
          return {
            ...s,
            match_placement: tr?.placement || 12,
            match_placement_points: tr?.placement_points || 0
          };
        });
      }

      // Group stats by player_id
      const statsByPlayer: { [playerId: number]: any[] } = {};
      allStatsRows.forEach(row => {
        if (!statsByPlayer[row.player_id]) statsByPlayer[row.player_id] = [];
        statsByPlayer[row.player_id].push(row);
      });

      const summaries: PlayerStatsSummary[] = players.map(player => {
        const statsRows = statsByPlayer[player.id] || [];

        const officialStats = {
          matches_played: 0,
          kills: 0,
          total_points: 0,
          avg_placement: 0,
          damage: 0,
          headshots: 0,
          avg_kills: 0,
          avg_damage: 0,
          top_kills_match: 0,
          has_stats: false
        };

        const unofficialStats = {
          matches_played: 0,
          kills: 0,
          total_points: 0,
          avg_placement: 0,
          damage: 0,
          headshots: 0,
          avg_kills: 0,
          avg_damage: 0,
          top_kills_match: 0,
          has_stats: false
        };

        let officialPlacementSum = 0;
        let unofficialPlacementSum = 0;

        statsRows.forEach(row => {
          const kills = Number(row.kills) || 0;
          const dmg = Number(row.damage) || 0;
          const hs = Number(row.headshots) || 0;
          const placement = Number(row.match_placement) || 12;
          const placementPts = Number(row.match_placement_points) || 0;
          const pts = kills + placementPts;

          if (row.is_official) {
            officialStats.matches_played += 1;
            officialStats.kills += kills;
            officialStats.total_points += pts;
            officialStats.damage += dmg;
            officialStats.headshots += hs;
            officialPlacementSum += placement;
            if (kills > officialStats.top_kills_match) officialStats.top_kills_match = kills;
          } else {
            unofficialStats.matches_played += 1;
            unofficialStats.kills += kills;
            unofficialStats.total_points += pts;
            unofficialStats.damage += dmg;
            unofficialStats.headshots += hs;
            unofficialPlacementSum += placement;
            if (kills > unofficialStats.top_kills_match) unofficialStats.top_kills_match = kills;
          }
        });

        if (officialStats.matches_played > 0) {
          officialStats.has_stats = true;
          officialStats.avg_kills = Number((officialStats.kills / officialStats.matches_played).toFixed(1));
          officialStats.avg_damage = Math.round(officialStats.damage / officialStats.matches_played);
          officialStats.avg_placement = Number((officialPlacementSum / officialStats.matches_played).toFixed(1));
        }

        if (unofficialStats.matches_played > 0) {
          unofficialStats.has_stats = true;
          unofficialStats.avg_kills = Number((unofficialStats.kills / unofficialStats.matches_played).toFixed(1));
          unofficialStats.avg_damage = Math.round(unofficialStats.damage / unofficialStats.matches_played);
          unofficialStats.avg_placement = Number((unofficialPlacementSum / unofficialStats.matches_played).toFixed(1));
        }

        const totalMatches = officialStats.matches_played + unofficialStats.matches_played;
        const totalKills = officialStats.kills + unofficialStats.kills;
        const totalPoints = officialStats.total_points + unofficialStats.total_points;
        const totalDamage = officialStats.damage + unofficialStats.damage;
        const totalHs = officialStats.headshots + unofficialStats.headshots;
        const combinedPlacementSum = officialPlacementSum + unofficialPlacementSum;

        const combined = {
          matches_played: totalMatches,
          kills: totalKills,
          total_points: totalPoints,
          avg_placement: totalMatches > 0 ? Number((combinedPlacementSum / totalMatches).toFixed(1)) : 0,
          damage: totalDamage,
          headshots: totalHs,
          avg_kills: totalMatches > 0 ? Number((totalKills / totalMatches).toFixed(1)) : 0,
          avg_damage: totalMatches > 0 ? Math.round(totalDamage / totalMatches) : 0
        };

        return {
          player_id: player.id,
          player_name: player.name,
          in_game_name: player.in_game_name,
          team_id: player.team_id,
          team_name: player.team_name || 'Free Agent',
          team_tag: player.team_tag || 'FA',
          team_logo: player.team_logo || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&auto=format&fit=crop',
          role: player.role || 'Rusher',
          avatar_url: player.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop',
          free_fire_uid: player.free_fire_uid || 'N/A',
          official: officialStats,
          unofficial: unofficialStats,
          combined
        };
      });

      return summaries;
    }, 10000);
  }

  // Get single player stats from the aggregated summary cache
  static async getPlayerStats(playerId: number): Promise<PlayerStatsSummary | null> {
    const all = await this.getAllPlayerStatsSummaries();
    return all.find(p => p.player_id === playerId) || null;
  }

  // Overall Global Analysis with Official Only Toggle
  static async getOverallAnalysis(officialOnly: boolean = false) {
    const cacheKey = `overall_analysis_${officialOnly}`;
    return getOrSetCache(cacheKey, async () => {
      const [tournaments, teams, playerSummaries, careerSummary] = await Promise.all([
        this.getAllTournaments(),
        this.getAllTeams(),
        this.getAllPlayerStatsSummaries(),
        this.getCareerSummary()
      ]);

      let allMatches: any[] = [];
      if (isPostgresActive) {
        const res = await db.query('SELECT * FROM matches' + (officialOnly ? ' WHERE is_official = TRUE' : ''));
        allMatches = res.rows;
      } else {
        allMatches = memoryDb.matches.filter(m => !officialOnly || m.is_official);
      }

      const teamAgg: { [id: number]: any } = {};

      teams.forEach(t => {
        teamAgg[t.id] = {
          team_id: t.id,
          name: t.name,
          tag: t.tag,
          logo_url: t.logo_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=200&auto=format&fit=crop',
          total_matches: 0,
          booyahs: 0,
          total_points: 0,
          total_kills: 0,
          avg_placement: 0,
          placements_sum: 0,
          win_rate: 0,
          consistency_score: 0
        };
      });

      let resultsList: any[] = [];
      if (isPostgresActive) {
        const res = await db.query('SELECT * FROM match_team_results' + (officialOnly ? ' WHERE is_official = TRUE' : ''));
        resultsList = res.rows;
      } else {
        resultsList = memoryDb.match_team_results.filter(r => !officialOnly || r.is_official);
      }

      resultsList.forEach(r => {
        const agg = teamAgg[r.team_id];
        if (agg) {
          agg.total_matches += 1;
          if (r.placement === 1) agg.booyahs += 1;
          agg.total_kills += Number(r.kills) || 0;
          agg.total_points += Number(r.total_points) || 0;
          agg.placements_sum += Number(r.placement) || 12;
        }
      });

      const rankedTeams = Object.values(teamAgg).filter((t: any) => t.total_matches > 0).map((t: any) => {
        const avgPlace = Number((t.placements_sum / t.total_matches).toFixed(1));
        const winRate = Number(((t.booyahs / t.total_matches) * 100).toFixed(1));
        const consistency = Number(((t.total_points / t.total_matches) * 2 + winRate * 0.5 - avgPlace * 2).toFixed(1));
        return {
          ...t,
          avg_placement: avgPlace,
          win_rate: winRate,
          consistency_score: Math.max(0, consistency)
        };
      });

      rankedTeams.sort((a, b) => b.total_points - a.total_points);

      const sortedPlayers = [...playerSummaries].map(p => {
        const activeStat = officialOnly ? p.official : p.combined;
        return {
          ...p,
          active_kills: activeStat.kills,
          active_matches: activeStat.matches_played,
          active_damage: activeStat.damage,
          active_avg_kills: activeStat.avg_kills,
          active_headshots: activeStat.headshots
        };
      }).filter(p => p.active_matches > 0);

      sortedPlayers.sort((a, b) => b.active_kills - a.active_kills);

      const mostConsistentTeam = [...rankedTeams].sort((a, b) => b.consistency_score - a.consistency_score)[0] || null;
      const topFragger = sortedPlayers[0] || null;

      const totalTournaments = tournaments.length;
      const totalMatchesCount = allMatches.length;
      const totalKillsAcross = rankedTeams.reduce((sum, t) => sum + t.total_kills, 0);

      const tagCareer = officialOnly ? careerSummary.official : careerSummary.combined;

      const tournamentsBreakdown = await Promise.all(tournaments.map(async tourney => {
        const summary = await this.getTournamentSummary(tourney.id);
        return {
          id: tourney.id,
          name: tourney.name,
          game_mode: tourney.game_mode,
          is_current: tourney.is_current,
          status: tourney.status,
          prize_pool: tourney.prize_pool,
          summary: officialOnly ? summary.official : summary.combined,
          total_matches_count: summary.total_matches,
          official_matches_count: summary.official_matches,
          has_unofficial: summary.has_unofficial
        };
      }));

      return {
        officialOnly,
        totalTournaments,
        totalMatchesCount,
        totalKillsAcross,
        rankedTeams,
        topPlayers: sortedPlayers.slice(0, 10),
        mostConsistentTeam,
        topFragger,
        tournamentsCount: tournaments.length,
        tagCareer,
        tournamentsBreakdown,
        tagPlayers: sortedPlayers.filter(p => p.team_tag === 'TAG' || p.team_name.includes('TAG'))
      };
    }, 10000);
  }

  // Get Map Analysis across all tournaments or for a specific tournament
  static async getMapAnalysis(officialOnly: boolean = false, tournamentId?: number): Promise<{ maps: MapStatDetail[]; overall: any }> {
    const cacheKey = `map_analysis_${officialOnly}_${tournamentId || 'all'}`;
    return getOrSetCache(cacheKey, async () => {
      const [tournaments, teams, players] = await Promise.all([
        this.getAllTournaments(),
        this.getAllTeams(),
        this.getAllPlayers()
      ]);

      const tagTeam = teams.find(t => t.tag === 'TAG' || t.name.includes('TAG')) || teams[0];
      const tagTeamId = tagTeam?.id || 1;

      let matchesList: any[] = [];
      if (isPostgresActive) {
        let query = `
          SELECT m.*, t.name as tournament_name
          FROM matches m
          JOIN tournaments t ON t.id = m.tournament_id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (officialOnly) {
          query += ' AND m.is_official = TRUE';
        }
        if (tournamentId) {
          params.push(tournamentId);
          query += ` AND m.tournament_id = $${params.length}`;
        }
        query += ' ORDER BY m.played_at ASC';
        const res = await db.query(query, params);
        matchesList = res.rows;
      } else {
        matchesList = memoryDb.matches.filter(m => {
          if (officialOnly && !m.is_official) return false;
          if (tournamentId && m.tournament_id !== tournamentId) return false;
          return true;
        }).map(m => {
          const t = memoryDb.tournaments.find(tourney => tourney.id === m.tournament_id);
          return { ...m, tournament_name: t?.name || 'Tournament' };
        });
      }

      // Fetch team results for these matches
      let allResults: any[] = [];
      if (matchesList.length > 0) {
        const matchIds = matchesList.map(m => m.id);
        if (isPostgresActive) {
          const res = await db.query(`
            SELECT r.*, t.name as team_name, t.tag as team_tag
            FROM match_team_results r
            JOIN teams t ON t.id = r.team_id
            WHERE r.match_id = ANY($1::int[])
          `, [matchIds]);
          allResults = res.rows;
        } else {
          allResults = memoryDb.match_team_results.filter(r => matchIds.includes(r.match_id)).map(r => {
            const t = memoryDb.teams.find(tm => tm.id === r.team_id);
            return { ...r, team_name: t?.name, team_tag: t?.tag };
          });
        }
      }

      // Group results by match
      const resultsByMatch: { [matchId: number]: any[] } = {};
      allResults.forEach(r => {
        if (!resultsByMatch[r.match_id]) resultsByMatch[r.match_id] = [];
        resultsByMatch[r.match_id].push(r);
      });

      // Prepare Map statistics map
      const mapMap: { [mapName: string]: MapStatDetail } = {};

      ALL_FREE_FIRE_MAPS.forEach(mapName => {
        const meta = MAP_METADATA[mapName] || {
          description: 'Competitive Free Fire MAX Arena',
          banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop',
          color: 'from-slate-500/20 to-slate-800/20 border-slate-500/30'
        };

        mapMap[mapName] = {
          map_name: mapName,
          display_name: mapName,
          description: meta.description,
          banner_url: meta.banner,
          color: meta.color,
          matches_played: 0,
          official_matches: 0,
          unofficial_matches: 0,
          total_kills: 0,
          tag_matches: 0,
          tag_kills: 0,
          tag_booyahs: 0,
          tag_kd: '0.00',
          tag_avg_kills: '0.0',
          tag_win_rate: '0.0',
          tag_total_points: 0,
          top_team: null,
          top_player: null
        };
      });

      const mapTeamStats: { [mapName: string]: { [teamId: number]: { name: string; tag: string; kills: number; booyahs: number; points: number } } } = {};

      matchesList.forEach(m => {
        const standardMap = ALL_FREE_FIRE_MAPS.find(name => name.toLowerCase() === (m.map_name || '').toLowerCase()) || m.map_name || 'Bermuda';
        if (!mapMap[standardMap]) {
          mapMap[standardMap] = {
            map_name: standardMap,
            display_name: standardMap,
            description: 'Competitive Free Fire MAX Arena',
            banner_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop',
            color: 'from-orange-500/20 to-red-600/10 border-orange-500/30',
            matches_played: 0,
            official_matches: 0,
            unofficial_matches: 0,
            total_kills: 0,
            tag_matches: 0,
            tag_kills: 0,
            tag_booyahs: 0,
            tag_kd: '0.00',
            tag_avg_kills: '0.0',
            tag_win_rate: '0.0',
            tag_total_points: 0,
            top_team: null,
            top_player: null
          };
        }

        const mapObj = mapMap[standardMap];
        mapObj.matches_played++;
        if (m.is_official) mapObj.official_matches++;
        else mapObj.unofficial_matches++;

        if (!mapTeamStats[standardMap]) mapTeamStats[standardMap] = {};

        const matchResults = resultsByMatch[m.id] || [];
        matchResults.forEach(r => {
          const kills = Number(r.kills) || 0;
          const pts = Number(r.total_points) || (kills + (r.placement === 1 ? 12 : Math.max(0, 10 - r.placement)));
          mapObj.total_kills += kills;

          if (!mapTeamStats[standardMap][r.team_id]) {
            mapTeamStats[standardMap][r.team_id] = {
              name: r.team_name || 'Team',
              tag: r.team_tag || 'TEAM',
              kills: 0,
              booyahs: 0,
              points: 0
            };
          }
          const tEntry = mapTeamStats[standardMap][r.team_id];
          tEntry.kills += kills;
          tEntry.points += pts;
          if (r.placement === 1) tEntry.booyahs++;

          if (r.team_id === tagTeamId || r.team_tag === 'TAG') {
            mapObj.tag_matches++;
            mapObj.tag_kills += kills;
            mapObj.tag_total_points += pts;
            if (r.placement === 1) mapObj.tag_booyahs++;
          }
        });
      });

      // Calculate ratios and top performers for each map
      const mapList = Object.values(mapMap);
      mapList.forEach(m => {
        const tagDeaths = Math.max(1, m.tag_matches - m.tag_booyahs);
        if (m.tag_matches > 0) {
          m.tag_kd = (m.tag_kills / tagDeaths).toFixed(2);
          m.tag_avg_kills = (m.tag_kills / m.tag_matches).toFixed(1);
          m.tag_win_rate = ((m.tag_booyahs / m.tag_matches) * 100).toFixed(1);
        }

        // Determine top team on this map
        const tStats = mapTeamStats[m.map_name];
        if (tStats) {
          const rankedMapTeams = Object.values(tStats).sort((a, b) => b.points - a.points);
          m.top_team = rankedMapTeams[0] || null;
        }
      });

      // Sort maps: most played first, then standard order
      mapList.sort((a, b) => {
        if (b.matches_played !== a.matches_played) return b.matches_played - a.matches_played;
        return ALL_FREE_FIRE_MAPS.indexOf(a.map_name) - ALL_FREE_FIRE_MAPS.indexOf(b.map_name);
      });

      const overall = {
        total_maps: mapList.filter(m => m.matches_played > 0).length,
        total_matches: mapList.reduce((acc, m) => acc + m.matches_played, 0),
        total_kills: mapList.reduce((acc, m) => acc + m.tag_kills, 0),
        most_played_map: mapList[0]?.map_name || 'Bermuda',
        highest_kd_map: [...mapList].sort((a, b) => parseFloat(b.tag_kd) - parseFloat(a.tag_kd))[0]?.map_name || 'Bermuda',
        highest_win_rate_map: [...mapList].sort((a, b) => parseFloat(b.tag_win_rate) - parseFloat(a.tag_win_rate))[0]?.map_name || 'Bermuda'
      };

      return { maps: mapList, overall };
    }, 10000);
  }

  // Get Comprehensive History Matches (Matches 1–6 across all or filtered tournaments)
  static async getFullMatchHistory(filters: {
    tournamentId?: number;
    mapName?: string;
    matchNumber?: number;
    officialOnly?: boolean;
    limit?: number;
  } = {}) {
    const cacheKey = `history_matches_${JSON.stringify(filters)}`;
    return getOrSetCache(cacheKey, async () => {
      const [tournaments, teams] = await Promise.all([
        this.getAllTournaments(),
        this.getAllTeams()
      ]);

      const tagTeam = teams.find(t => t.tag === 'TAG' || t.name.includes('TAG')) || teams[0];
      const tagTeamId = tagTeam?.id || 1;

      let matchesList: any[] = [];
      if (isPostgresActive) {
        let query = `
          SELECT m.*, t.name as tournament_name, t.banner_url as tournament_banner, t.is_current as tournament_is_current
          FROM matches m
          JOIN tournaments t ON t.id = m.tournament_id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (filters.tournamentId) {
          params.push(filters.tournamentId);
          query += ` AND m.tournament_id = $${params.length}`;
        }
        if (filters.mapName && filters.mapName !== 'all') {
          params.push(filters.mapName);
          query += ` AND LOWER(m.map_name) = LOWER($${params.length})`;
        }
        if (filters.matchNumber) {
          params.push(filters.matchNumber);
          query += ` AND m.match_number = $${params.length}`;
        }
        if (filters.officialOnly) {
          query += ' AND m.is_official = TRUE';
        }
        query += ' ORDER BY m.played_at DESC, m.id DESC';
        if (filters.limit) {
          params.push(filters.limit);
          query += ` LIMIT $${params.length}`;
        }
        const res = await db.query(query, params);
        matchesList = res.rows;
      } else {
        matchesList = memoryDb.matches.filter(m => {
          if (filters.tournamentId && m.tournament_id !== filters.tournamentId) return false;
          if (filters.mapName && filters.mapName !== 'all' && m.map_name.toLowerCase() !== filters.mapName.toLowerCase()) return false;
          if (filters.matchNumber && m.match_number !== filters.matchNumber) return false;
          if (filters.officialOnly && !m.is_official) return false;
          return true;
        }).map(m => {
          const t = memoryDb.tournaments.find(tourney => tourney.id === m.tournament_id);
          return {
            ...m,
            tournament_name: t?.name || 'Tournament',
            tournament_banner: t?.banner_url,
            tournament_is_current: t?.is_current
          };
        }).sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());

        if (filters.limit) {
          matchesList = matchesList.slice(0, filters.limit);
        }
      }

      if (matchesList.length === 0) return [];

      const matchIds = matchesList.map(m => m.id);
      let allResults: any[] = [];
      if (isPostgresActive) {
        const res = await db.query(`
          SELECT r.*, t.name as team_name, t.tag as team_tag, t.logo_url as team_logo
          FROM match_team_results r
          JOIN teams t ON t.id = r.team_id
          WHERE r.match_id = ANY($1::int[])
          ORDER BY r.placement ASC
        `, [matchIds]);
        allResults = res.rows;
      } else {
        allResults = memoryDb.match_team_results.filter(r => matchIds.includes(r.match_id)).map(r => {
          const t = memoryDb.teams.find(tm => tm.id === r.team_id);
          return { ...r, team_name: t?.name, team_tag: t?.tag, team_logo: t?.logo_url };
        }).sort((a, b) => a.placement - b.placement);
      }

      const resultsByMatch: { [matchId: number]: any[] } = {};
      allResults.forEach(r => {
        if (!resultsByMatch[r.match_id]) resultsByMatch[r.match_id] = [];
        resultsByMatch[r.match_id].push(r);
      });

      return matchesList.map(m => {
        const results = resultsByMatch[m.id] || [];
        const booyahTeam = results.find(r => r.placement === 1) || null;
        const tagResult = results.find(r => r.team_id === tagTeamId || r.team_tag === 'TAG') || null;
        const topFraggerTeam = [...results].sort((a, b) => b.kills - a.kills)[0] || null;

        return {
          ...m,
          results,
          booyahTeam,
          tagResult,
          topFraggerTeam
        };
      });
    }, 10000);
  }

  // Create Batch Matches (1-6 Matches) and Auto-Save to Tournament History with complete scoreboard
  static async createBatchMatches(tournamentId: number, matchConfigs: {
    match_number: number;
    map_name: string;
    is_official: boolean;
    notes?: string;
    custom_tag_kills?: number;
    custom_tag_placement?: number;
  }[]) {
    this.invalidateCache();
    const teams = await this.getAllTeams();

    const createdMatchIds: number[] = [];
    let nextMatchId = (memoryDb.matches.length > 0 ? Math.max(...memoryDb.matches.map(m => m.id)) : 0) + 1;
    let nextResultId = (memoryDb.match_team_results.length > 0 ? Math.max(...memoryDb.match_team_results.map(r => r.id)) : 0) + 1;

    for (const cfg of matchConfigs) {
      const matchNumber = cfg.match_number;
      const mapName = cfg.map_name || 'Bermuda';
      const isOfficial = cfg.is_official !== false;
      const notes = cfg.notes || `Match ${matchNumber} • ${mapName}`;

      let matchId: number;
      if (isPostgresActive) {
        const res = await db.query(`
          INSERT INTO matches (tournament_id, match_number, map_name, played_at, status, is_official, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [tournamentId, matchNumber, mapName, new Date(), 'completed', isOfficial, notes]);
        matchId = res.rows[0].id;
      } else {
        matchId = nextMatchId++;
        memoryDb.matches.push({
          id: matchId,
          tournament_id: tournamentId,
          match_number: matchNumber,
          map_name: mapName,
          played_at: new Date().toISOString(),
          status: 'completed',
          is_official: isOfficial,
          notes
        });
      }

      createdMatchIds.push(matchId);

      // Populate placements 1 to 12 for standard 12-squad Free Fire match
      const squadCount = Math.min(12, teams.length);
      const tagPlacement = cfg.custom_tag_placement || (matchNumber % 2 === 1 ? 1 : 2);
      const tagKills = cfg.custom_tag_kills !== undefined ? cfg.custom_tag_kills : (tagPlacement === 1 ? 8 + matchNumber : 5);

      let currentPlacement = 1;
      for (let i = 0; i < squadCount; i++) {
        const team = teams[i];
        let placement = currentPlacement;
        let kills = Math.floor(Math.random() * 4);

        if (team.tag === 'TAG' || team.name.includes('TAG')) {
          placement = tagPlacement;
          kills = tagKills;
        } else if (currentPlacement === tagPlacement) {
          currentPlacement++;
          placement = currentPlacement;
        }

        const placementPoints = placement === 1 ? 12 : (placement === 2 ? 9 : (placement === 3 ? 8 : (placement === 4 ? 7 : (placement === 5 ? 6 : (placement === 6 ? 5 : (placement === 7 ? 4 : (placement === 8 ? 3 : (placement === 9 ? 2 : (placement === 10 ? 1 : 0)))))))));
        const totalPoints = placementPoints + kills;

        if (isPostgresActive) {
          await db.query(`
            INSERT INTO match_team_results (match_id, team_id, placement, kills, placement_points, kill_points, total_points, is_official)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [matchId, team.id, placement, kills, placementPoints, kills, totalPoints, isOfficial]);
        } else {
          memoryDb.match_team_results.push({
            id: nextResultId++,
            match_id: matchId,
            team_id: team.id,
            placement,
            kills,
            placement_points: placementPoints,
            kill_points: kills,
            total_points: totalPoints,
            is_official: isOfficial
          });
        }

        if (placement !== tagPlacement) {
          currentPlacement++;
        }
      }
    }

    this.invalidateCache();
    return createdMatchIds;
  }
}
