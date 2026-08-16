import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database interface
export interface DbClient {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
}

let pool: pg.Pool | null = null;
let isPostgresActive = false;

// In-memory fallback database for local preview / when DATABASE_URL is not yet connected
interface InMemoryData {
  tournaments: any[];
  teams: any[];
  players: any[];
  matches: any[];
  match_team_results: any[];
  match_player_stats: any[];
  site_settings: { [key: string]: string };
}

const memoryDb: InMemoryData = {
  tournaments: [],
  teams: [],
  players: [],
  matches: [],
  match_team_results: [],
  match_player_stats: [],
  site_settings: {
    site_background_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop',
    site_title: 'TAGFREEFIREMAX',
    site_tagline: 'Premier Free Fire MAX Esports Hub',
    admin_contact: 'admin@tagfreefiremax.com'
  }
};

let autoIncrementId = 100;
let initDbPromise: Promise<void> | null = null;

export function ensureDbReady(): Promise<void> {
  if (!initDbPromise) {
    initDbPromise = initDb();
  }
  return initDbPromise;
}

export async function initDb(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString && connectionString.startsWith('postgres') && !connectionString.includes('ep-sample-pooler')) {
    try {
      pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false
        }
      });

      // Test connection
      const client = await pool.connect();
      console.log('Connected successfully to Neon PostgreSQL database.');
      client.release();
      isPostgresActive = true;

      // Run schema migrations to ensure all tables & columns exist
      await createTablesIfNotExist();
      await ensureSeedDataIfEmpty();
      return;
    } catch (err: any) {
      console.warn('PostgreSQL connection attempt failed. Falling back to local storage engine.', err.message);
      isPostgresActive = false;
    }
  } else {
    console.log('Using in-memory/local storage engine.');
    isPostgresActive = false;
  }

  // Populate memory DB with fresh clean zeroed state
  seedMemoryDb();
}

async function createTablesIfNotExist() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    // 1. Create base tables if they do not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        game_mode VARCHAR(100) DEFAULT 'Battle Royale Squad',
        banner_url TEXT,
        start_date DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'ongoing',
        is_current BOOLEAN DEFAULT FALSE,
        prize_pool VARCHAR(100) DEFAULT '$0',
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tag VARCHAR(20) NOT NULL,
        logo_url TEXT,
        country VARCHAR(100) DEFAULT 'Global',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        in_game_name VARCHAR(100) NOT NULL,
        role VARCHAR(100) DEFAULT 'Rusher',
        avatar_url TEXT,
        free_fire_uid VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
        match_number INTEGER NOT NULL,
        map_name VARCHAR(100) DEFAULT 'Bermuda',
        played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'completed',
        is_official BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS match_team_results (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        placement INTEGER NOT NULL,
        kills INTEGER DEFAULT 0,
        placement_points INTEGER DEFAULT 0,
        kill_points INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        is_official BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS match_player_stats (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        kills INTEGER DEFAULT 0,
        damage INTEGER DEFAULT 0,
        headshots INTEGER DEFAULT 0,
        survival_time_sec INTEGER DEFAULT 0,
        is_official BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Automatic Alter Migrations: guarantee all columns exist even on pre-existing Postgres databases
    await client.query(`
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE;
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS game_mode VARCHAR(100) DEFAULT 'Battle Royale Squad';
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ongoing';
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_pool VARCHAR(100) DEFAULT '$0';
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE teams ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS tag VARCHAR(20);
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Global';
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE players ADD COLUMN IF NOT EXISTS team_id INTEGER;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE players ADD COLUMN IF NOT EXISTS in_game_name VARCHAR(100);
      ALTER TABLE players ADD COLUMN IF NOT EXISTS role VARCHAR(100) DEFAULT 'Rusher';
      ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS free_fire_uid VARCHAR(100);
      ALTER TABLE players ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id INTEGER;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_number INTEGER;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS map_name VARCHAR(100) DEFAULT 'Bermuda';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS match_id INTEGER;
      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS team_id INTEGER;
      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS placement INTEGER;
      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS kills INTEGER DEFAULT 0;
      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS placement_points INTEGER DEFAULT 0;
      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS kill_points INTEGER DEFAULT 0;
      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;
      ALTER TABLE match_team_results ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS match_id INTEGER;
      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS player_id INTEGER;
      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS team_id INTEGER;
      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS kills INTEGER DEFAULT 0;
      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS damage INTEGER DEFAULT 0;
      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS headshots INTEGER DEFAULT 0;
      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS survival_time_sec INTEGER DEFAULT 0;
      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;
      ALTER TABLE match_player_stats ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);
  } finally {
    client.release();
  }
}

async function ensureSeedDataIfEmpty() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    const teamsCount = await client.query('SELECT COUNT(*) as count FROM teams');
    if (parseInt(teamsCount.rows[0]?.count || '0', 10) === 0) {
      await populatePostgresSeed();
    }
  } catch (err) {
    console.warn('Error checking/seeding initial team:', err);
  } finally {
    client.release();
  }
}

export async function resetAllWebsiteData() {
  if (isPostgresActive && pool) {
    await populatePostgresSeed();
  }
  seedMemoryDb();
}

async function populatePostgresSeed() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clean existing data for a fresh clean restart
    await client.query('TRUNCATE TABLE match_player_stats, match_team_results, matches, players, teams, tournaments RESTART IDENTITY CASCADE;');

    // Site Settings
    await client.query(`
      INSERT INTO site_settings (key, value) VALUES
      ('site_background_url', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop'),
      ('site_title', 'TAGFREEFIREMAX'),
      ('site_tagline', 'TAGFREEFIREMAX Esports Command Center')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Single Team: TAGFREEFIREMAX
    const teamsRes = await client.query(`
      INSERT INTO teams (name, tag, logo_url, country) VALUES
      ('TAGFREEFIREMAX', 'TAG', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop', 'Global / India')
      RETURNING id, name, tag;
    `);

    const tagTeamId = teamsRes.rows[0].id;

    // 5 Players for the team ready with 0 stats
    await client.query(`
      INSERT INTO players (team_id, name, in_game_name, role, avatar_url, free_fire_uid) VALUES
      (${tagTeamId}, 'Kuldeep "KD" Sharma', 'TAG KD', 'IGL / Captain / Rusher', 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=400&auto=format&fit=crop', 'TAG-99014521'),
      (${tagTeamId}, 'Shourya "Shoto" Sen', 'TAG SHOTO', 'Main Sniper / Fragger', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop', 'TAG-99014522'),
      (${tagTeamId}, 'Rohan "Wolvin" Verma', 'TAG WOLVIN', 'Rusher / Assaulter', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=400&auto=format&fit=crop', 'TAG-99014523'),
      (${tagTeamId}, 'Sahil "Sahil" Roy', 'TAG SAHIL', 'Support / Flanker', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop', 'TAG-99014524'),
      (${tagTeamId}, 'Louis "Louis" D''Souza', 'TAG LOUIS', 'Entry Fragger / Assaulter', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop', 'TAG-99014525');
    `);

    await client.query('COMMIT');
    console.log('Clean fresh restart initialized: 0 tournaments, 0 matches, 0 details.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed error:', e);
  } finally {
    client.release();
  }
}

// Fallback In-Memory seed setup: Fresh clean starting state (0 tournaments, 0 matches)
function seedMemoryDb() {
  memoryDb.tournaments = [];

  // ONLY ONE TEAM: TAGFREEFIREMAX
  memoryDb.teams = [
    { 
      id: 1, 
      name: 'TAGFREEFIREMAX', 
      tag: 'TAG', 
      logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop', 
      country: 'Global / India', 
      created_at: new Date() 
    }
  ];

  // ONLY 5 PLAYERS with 0 stats: TAG KD, TAG SHOTO, TAG WOLVIN, TAG SAHIL, TAG LOUIS
  memoryDb.players = [
    { 
      id: 1, 
      team_id: 1, 
      name: 'Kuldeep "KD" Sharma', 
      in_game_name: 'TAG KD', 
      role: 'IGL / Captain / Rusher', 
      avatar_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=400&auto=format&fit=crop', 
      free_fire_uid: 'TAG-99014521' 
    },
    { 
      id: 2, 
      team_id: 1, 
      name: 'Shourya "Shoto" Sen', 
      in_game_name: 'TAG SHOTO', 
      role: 'Main Sniper / Fragger', 
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop', 
      free_fire_uid: 'TAG-99014522' 
    },
    { 
      id: 3, 
      team_id: 1, 
      name: 'Rohan "Wolvin" Verma', 
      in_game_name: 'TAG WOLVIN', 
      role: 'Rusher / Assaulter', 
      avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=400&auto=format&fit=crop', 
      free_fire_uid: 'TAG-99014523' 
    },
    { 
      id: 4, 
      team_id: 1, 
      name: 'Sahil "Sahil" Roy', 
      in_game_name: 'TAG SAHIL', 
      role: 'Support / Flanker', 
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop', 
      free_fire_uid: 'TAG-99014524' 
    },
    { 
      id: 5, 
      team_id: 1, 
      name: 'Louis "Louis" D\'Souza', 
      in_game_name: 'TAG LOUIS', 
      role: 'Entry Fragger / Assaulter', 
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop', 
      free_fire_uid: 'TAG-99014525' 
    }
  ];

  memoryDb.matches = [];
  memoryDb.match_team_results = [];
  memoryDb.match_player_stats = [];
}

export const db: DbClient = {
  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    await ensureDbReady();
    if (isPostgresActive && pool) {
      const result = await pool.query(text, params);
      return { rows: result.rows, rowCount: result.rowCount || 0 };
    }

    // Memory Store query emulator
    const cleanText = text.trim();

    // 1. SELECT site_settings
    if (cleanText.includes('FROM site_settings WHERE key = $1')) {
      const key = params[0];
      const val = memoryDb.site_settings[key];
      return { rows: val !== undefined ? [{ key, value: val }] : [], rowCount: val !== undefined ? 1 : 0 };
    }
    if (cleanText.includes('FROM site_settings')) {
      const rows = Object.entries(memoryDb.site_settings).map(([k, v]) => ({ key: k, value: v }));
      return { rows, rowCount: rows.length };
    }
    if (cleanText.includes('INSERT INTO site_settings') || cleanText.includes('UPDATE site_settings')) {
      const key = params[0];
      const val = params[1];
      memoryDb.site_settings[key] = val;
      return { rows: [{ key, value: val }], rowCount: 1 };
    }

    // 2. Tournaments
    if (cleanText.includes('FROM tournaments WHERE is_current = TRUE') || cleanText.includes('is_current = true')) {
      const cur = memoryDb.tournaments.find(t => t.is_current);
      return { rows: cur ? [cur] : [], rowCount: cur ? 1 : 0 };
    }
    if (cleanText.includes('FROM tournaments WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      const t = memoryDb.tournaments.find(x => x.id === id);
      return { rows: t ? [t] : [], rowCount: t ? 1 : 0 };
    }
    if (cleanText.includes('FROM tournaments ORDER BY')) {
      const sorted = [...memoryDb.tournaments].sort((a, b) => {
        if (a.is_current) return -1;
        if (b.is_current) return 1;
        return new Date(b.start_date || b.created_at).getTime() - new Date(a.start_date || a.created_at).getTime();
      });
      return { rows: sorted, rowCount: sorted.length };
    }
    if (cleanText.includes('FROM tournaments')) {
      return { rows: memoryDb.tournaments, rowCount: memoryDb.tournaments.length };
    }
    if (cleanText.includes('INSERT INTO tournaments')) {
      autoIncrementId++;
      const newT = {
        id: autoIncrementId,
        name: params[0],
        game_mode: params[1],
        banner_url: params[2],
        start_date: params[3],
        end_date: params[4],
        status: params[5],
        is_current: params[6] === true || params[6] === 'true',
        prize_pool: params[7],
        description: params[8],
        created_at: new Date()
      };
      if (newT.is_current) {
        memoryDb.tournaments.forEach(t => { t.is_current = false; });
      }
      memoryDb.tournaments.unshift(newT);
      return { rows: [newT], rowCount: 1 };
    }
    if (cleanText.includes('UPDATE tournaments SET is_current = FALSE')) {
      memoryDb.tournaments.forEach(t => { t.is_current = false; });
      return { rows: [], rowCount: memoryDb.tournaments.length };
    }
    if (cleanText.includes('UPDATE tournaments')) {
      const id = parseInt(params[params.length - 1], 10);
      const t = memoryDb.tournaments.find(x => x.id === id);
      if (t) {
        // Simple update mapping
        if (params.length >= 8) {
          t.name = params[0];
          t.game_mode = params[1];
          t.banner_url = params[2] || t.banner_url;
          t.start_date = params[3];
          t.end_date = params[4];
          t.status = params[5];
          t.is_current = params[6] === true || params[6] === 'true';
          t.prize_pool = params[7];
          t.description = params[8];
        } else if (cleanText.includes('is_current = TRUE')) {
          memoryDb.tournaments.forEach(x => { x.is_current = false; });
          t.is_current = true;
        }
      }
      return { rows: t ? [t] : [], rowCount: t ? 1 : 0 };
    }
    if (cleanText.includes('DELETE FROM tournaments WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      memoryDb.tournaments = memoryDb.tournaments.filter(x => x.id !== id);
      return { rows: [], rowCount: 1 };
    }

    // 3. Teams
    if (cleanText.includes('FROM teams WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      const tm = memoryDb.teams.find(x => x.id === id);
      return { rows: tm ? [tm] : [], rowCount: tm ? 1 : 0 };
    }
    if (cleanText.includes('FROM teams')) {
      return { rows: memoryDb.teams, rowCount: memoryDb.teams.length };
    }
    if (cleanText.includes('INSERT INTO teams')) {
      autoIncrementId++;
      const newTeam = {
        id: autoIncrementId,
        name: params[0],
        tag: params[1],
        logo_url: params[2],
        country: params[3] || 'Global',
        created_at: new Date()
      };
      memoryDb.teams.push(newTeam);
      return { rows: [newTeam], rowCount: 1 };
    }
    if (cleanText.includes('UPDATE teams')) {
      const id = parseInt(params[params.length - 1], 10);
      const tm = memoryDb.teams.find(x => x.id === id);
      if (tm) {
        if (cleanText.includes('SET logo_url = $1 WHERE id = $2') || cleanText.includes('SET logo_url = $1')) {
          tm.logo_url = params[0];
        } else {
          tm.name = params[0] || tm.name;
          tm.tag = params[1] || tm.tag;
          if (params[2]) tm.logo_url = params[2];
          tm.country = params[3] || tm.country;
        }
      }
      return { rows: tm ? [tm] : [], rowCount: tm ? 1 : 0 };
    }
    if (cleanText.includes('DELETE FROM teams WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      memoryDb.teams = memoryDb.teams.filter(x => x.id !== id);
      return { rows: [], rowCount: 1 };
    }

    // 4. Players
    if (cleanText.includes('FROM players WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      const p = memoryDb.players.find(x => x.id === id);
      if (p) {
        const team = memoryDb.teams.find(t => t.id === p.team_id);
        return { rows: [{ ...p, team_name: team?.name, team_tag: team?.tag, team_logo: team?.logo_url }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (cleanText.includes('FROM players WHERE team_id = $1')) {
      const tid = parseInt(params[0], 10);
      const list = memoryDb.players.filter(x => x.team_id === tid);
      return { rows: list, rowCount: list.length };
    }
    if (cleanText.includes('FROM players')) {
      const list = memoryDb.players.map(p => {
        const tm = memoryDb.teams.find(t => t.id === p.team_id);
        return { ...p, team_name: tm?.name, team_tag: tm?.tag, team_logo: tm?.logo_url };
      });
      return { rows: list, rowCount: list.length };
    }
    if (cleanText.includes('INSERT INTO players')) {
      autoIncrementId++;
      const newP = {
        id: autoIncrementId,
        team_id: params[0] ? parseInt(params[0], 10) : null,
        name: params[1],
        in_game_name: params[2],
        role: params[3],
        avatar_url: params[4],
        free_fire_uid: params[5],
        created_at: new Date()
      };
      memoryDb.players.push(newP);
      return { rows: [newP], rowCount: 1 };
    }
    if (cleanText.includes('UPDATE players')) {
      const id = parseInt(params[params.length - 1], 10);
      const p = memoryDb.players.find(x => x.id === id);
      if (p) {
        if (cleanText.includes('SET avatar_url = $1 WHERE id = $2') || cleanText.includes('SET avatar_url = $1')) {
          p.avatar_url = params[0];
        } else {
          p.team_id = params[0] ? parseInt(params[0], 10) : p.team_id;
          p.name = params[1] || p.name;
          p.in_game_name = params[2] || p.in_game_name;
          p.role = params[3] || p.role;
          if (params[4]) p.avatar_url = params[4];
          p.free_fire_uid = params[5] !== undefined ? params[5] : p.free_fire_uid;
        }
      }
      return { rows: p ? [p] : [], rowCount: p ? 1 : 0 };
    }
    if (cleanText.includes('DELETE FROM players WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      memoryDb.players = memoryDb.players.filter(x => x.id !== id);
      return { rows: [], rowCount: 1 };
    }

    // 5. Matches
    if (cleanText.includes('FROM matches WHERE tournament_id = $1')) {
      const tid = parseInt(params[0], 10);
      const list = memoryDb.matches
        .filter(m => m.tournament_id === tid)
        .sort((a, b) => b.match_number - a.match_number);
      return { rows: list, rowCount: list.length };
    }
    if (cleanText.includes('FROM matches WHERE id = $1')) {
      const mid = parseInt(params[0], 10);
      const m = memoryDb.matches.find(x => x.id === mid);
      return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
    }
    if (cleanText.includes('FROM matches')) {
      return { rows: memoryDb.matches, rowCount: memoryDb.matches.length };
    }
    if (cleanText.includes('INSERT INTO matches')) {
      autoIncrementId++;
      const newM = {
        id: autoIncrementId,
        tournament_id: parseInt(params[0], 10),
        match_number: parseInt(params[1], 10),
        map_name: params[2],
        played_at: params[3] ? new Date(params[3]) : new Date(),
        status: params[4] || 'completed',
        is_official: params[5] === true || params[5] === 'true',
        notes: params[6] || '',
        created_at: new Date()
      };
      memoryDb.matches.push(newM);
      return { rows: [newM], rowCount: 1 };
    }
    if (cleanText.includes('UPDATE matches SET is_official = $1 WHERE id = $2')) {
      const isOff = params[0] === true || params[0] === 'true';
      const mid = parseInt(params[1], 10);
      const m = memoryDb.matches.find(x => x.id === mid);
      if (m) {
        m.is_official = isOff;
        memoryDb.match_team_results.forEach(r => {
          if (r.match_id === mid) r.is_official = isOff;
        });
        memoryDb.match_player_stats.forEach(ps => {
          if (ps.match_id === mid) ps.is_official = isOff;
        });
      }
      return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
    }
    if (cleanText.includes('DELETE FROM matches WHERE id = $1')) {
      const mid = parseInt(params[0], 10);
      memoryDb.matches = memoryDb.matches.filter(x => x.id !== mid);
      memoryDb.match_team_results = memoryDb.match_team_results.filter(x => x.match_id !== mid);
      memoryDb.match_player_stats = memoryDb.match_player_stats.filter(x => x.match_id !== mid);
      return { rows: [], rowCount: 1 };
    }

    // 6. Match team results
    if (cleanText.includes('FROM match_team_results')) {
      let list = memoryDb.match_team_results;
      if (cleanText.includes('WHERE match_id = $1') || cleanText.includes('WHERE r.match_id = $1')) {
        const mid = parseInt(params[0], 10);
        list = list.filter(r => r.match_id === mid);
      } else if (cleanText.includes('match_id = ANY') || cleanText.includes('r.match_id = ANY')) {
        const targetIds: number[] = Array.isArray(params[0]) ? params[0].map(Number) : [parseInt(params[0], 10)];
        list = list.filter(r => targetIds.includes(r.match_id));
      }
      const formatted = list.map(r => {
        const tm = memoryDb.teams.find(t => t.id === r.team_id);
        return { ...r, team_name: tm?.name || 'TAGFREEFIREMAX', team_tag: tm?.tag || 'TAG', team_logo: tm?.logo_url || '' };
      }).sort((a, b) => a.placement - b.placement);
      return { rows: formatted, rowCount: formatted.length };
    }
    if (cleanText.includes('INSERT INTO match_team_results')) {
      autoIncrementId++;
      const matchId = parseInt(params[0], 10);
      const teamId = parseInt(params[1], 10);
      // Remove any prior entry for this same match and team to avoid duplicates
      memoryDb.match_team_results = memoryDb.match_team_results.filter(x => !(x.match_id === matchId && x.team_id === teamId));
      const newR = {
        id: autoIncrementId,
        match_id: matchId,
        team_id: teamId,
        placement: parseInt(params[2], 10) || 1,
        kills: parseInt(params[3], 10) || 0,
        placement_points: parseInt(params[4], 10) || 0,
        kill_points: parseInt(params[5], 10) || 0,
        total_points: parseInt(params[6], 10) || 0,
        is_official: params[7] === true || params[7] === 'true',
        created_at: new Date()
      };
      memoryDb.match_team_results.push(newR);
      return { rows: [newR], rowCount: 1 };
    }
    if (cleanText.includes('DELETE FROM match_team_results WHERE match_id = $1')) {
      const mid = parseInt(params[0], 10);
      memoryDb.match_team_results = memoryDb.match_team_results.filter(x => x.match_id !== mid);
      return { rows: [], rowCount: 1 };
    }

    // 7. Match player stats
    if (cleanText.includes('FROM match_player_stats')) {
      let list = memoryDb.match_player_stats;
      if (cleanText.includes('WHERE match_id = $1') || cleanText.includes('WHERE ps.match_id = $1')) {
        const mid = parseInt(params[0], 10);
        list = list.filter(s => s.match_id === mid);
      } else if (cleanText.includes('match_id = ANY') || cleanText.includes('ps.match_id = ANY')) {
        const targetIds: number[] = Array.isArray(params[0]) ? params[0].map(Number) : [parseInt(params[0], 10)];
        list = list.filter(s => targetIds.includes(s.match_id));
      }
      
      // Deduplicate by match_id + player_id to prevent duplicates
      const seen = new Set<string>();
      const dedupedList: any[] = [];
      for (const s of list) {
        const key = `${s.match_id}_${s.player_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          dedupedList.push(s);
        }
      }

      const formatted = dedupedList.map(s => {
        const p = memoryDb.players.find(pl => pl.id === s.player_id);
        return { 
          ...s, 
          player_name: p?.name || 'Player', 
          in_game_name: p?.in_game_name || `TAG P${s.player_id}`, 
          avatar_url: p?.avatar_url || '', 
          role: p?.role || 'Rusher' 
        };
      }).sort((a, b) => (b.kills || 0) - (a.kills || 0));
      return { rows: formatted, rowCount: formatted.length };
    }
    if (cleanText.includes('INSERT INTO match_player_stats')) {
      autoIncrementId++;
      const matchId = parseInt(params[0], 10);
      const playerId = parseInt(params[1], 10);
      // Remove any prior entry for this match & player to ensure NO duplicates
      memoryDb.match_player_stats = memoryDb.match_player_stats.filter(x => !(x.match_id === matchId && x.player_id === playerId));
      const newPs = {
        id: autoIncrementId,
        match_id: matchId,
        player_id: playerId,
        team_id: parseInt(params[2], 10) || 1,
        kills: parseInt(params[3], 10) || 0,
        damage: parseInt(params[4], 10) || 0,
        headshots: parseInt(params[5], 10) || 0,
        survival_time_sec: parseInt(params[6], 10) || 0,
        is_official: params[7] === true || params[7] === 'true',
        created_at: new Date()
      };
      memoryDb.match_player_stats.push(newPs);
      return { rows: [newPs], rowCount: 1 };
    }
    if (cleanText.includes('DELETE FROM match_player_stats WHERE match_id = $1')) {
      const mid = parseInt(params[0], 10);
      memoryDb.match_player_stats = memoryDb.match_player_stats.filter(x => x.match_id !== mid);
      return { rows: [], rowCount: 1 };
    }

    // Default fallback
    return { rows: [], rowCount: 0 };
  }
};

export { memoryDb, isPostgresActive };
