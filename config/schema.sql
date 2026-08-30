-- TAGFREEFIREMAX PostgreSQL Schema (Neon.tech compatible)

CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    game_mode VARCHAR(100) DEFAULT 'Battle Royale Squad',
    banner_url TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'ongoing', -- 'upcoming', 'ongoing', 'completed'
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
    role VARCHAR(100) DEFAULT 'Rusher', -- Rusher, Sniper, IGL, Support, Flanker
    avatar_url TEXT,
    free_fire_uid VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    match_number INTEGER NOT NULL,
    map_name VARCHAR(100) DEFAULT 'Bermuda', -- Bermuda, Purgatory, Kalahari, Solara, Nexterra
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'completed', -- 'scheduled', 'live', 'completed'
    is_official BOOLEAN DEFAULT FALSE, -- Official verified results vs Unofficial / Live provisional
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

-- Indices for rapid query performance
CREATE INDEX IF NOT EXISTS idx_tournaments_is_current ON tournaments(is_current);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_is_official ON matches(is_official);
CREATE INDEX IF NOT EXISTS idx_team_results_match ON match_team_results(match_id);
CREATE INDEX IF NOT EXISTS idx_team_results_team ON match_team_results(team_id);
CREATE INDEX IF NOT EXISTS idx_team_results_is_official ON match_team_results(is_official);
CREATE INDEX IF NOT EXISTS idx_player_stats_player ON match_player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_is_official ON match_player_stats(is_official);
