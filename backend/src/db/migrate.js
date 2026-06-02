require('dotenv').config();
const db = require('./index');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const createTables = async () => {
  const client = await db.getClient();

  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'agent')),
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Refresh tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Leads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(30),
        source VARCHAR(50),
        status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
        assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Activity logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Agent assignment tracker
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_assignment_tracker (
        agent_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        lead_count INTEGER DEFAULT 0,
        last_assigned_at DATETIME
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_lead_id ON activity_logs(lead_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const seedAdminUser = async () => {
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');

  const existing = await db.query("SELECT id FROM users WHERE email = 'admin@leadmanager.com'");
  if (existing.rows.length > 0) {
    logger.info('Admin user already exists, skipping seed');
    return;
  }

  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  await db.query(
    'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
    [uuidv4(), 'System Admin', 'admin@leadmanager.com', hashedPassword, 'admin']
  );
  logger.info('Admin user seeded: admin@leadmanager.com / Admin@123');
};

const run = async () => {
  try {
    await createTables();
    await seedAdminUser();
    logger.info('Migration and seeding complete');
    process.exit(0);
  } catch (err) {
    logger.error('Migration error:', err);
    process.exit(1);
  }
};

run();
