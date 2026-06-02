const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'lead_management.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

const convertSqlToSqlite = (sql, params = []) => {
  let result = sql;

  // Convert PostgreSQL-specific syntax first (before parameter replacement)
  result = result.replace(/gen_random_uuid\(\)/g, "('" + require('uuid').v4() + "')");
  result = result.replace(/UUID PRIMARY KEY/g, "TEXT PRIMARY KEY");
  result = result.replace(/UUID NOT NULL REFERENCES/g, "TEXT NOT NULL REFERENCES");
  result = result.replace(/UUID REFERENCES/g, "TEXT REFERENCES");
  result = result.replace(/TIMESTAMP WITH TIME ZONE/g, "DATETIME");
  result = result.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s+days?'/gi, "datetime('now', '-$1 days')");
  result = result.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s+hours?'/gi, "datetime('now', '-$1 hours')");
  result = result.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s+minutes?'/gi, "datetime('now', '-$1 minutes')");
  result = result.replace(/NOW\(\)/g, "datetime('now')");
  result = result.replace(/JSONB/g, "TEXT");
  result = result.replace(/ILIKE/g, "LIKE");
  result = result.replace(/GREATEST\(/g, "MAX(");

  // Convert $N parameters to ? while tracking order (handles repeated $N like $2 OR $2 OR $2)
  const expandedParams = [];
  result = result.replace(/\$(\d+)/g, (match, num) => {
    const idx = parseInt(num) - 1; // $1 → index 0
    expandedParams.push(params[idx]);
    return '?';
  });

  return { sql: result, expandedParams };
};

const extractReturningClause = (sql) => {
  const returningMatch = sql.match(/RETURNING\s+(.+?)$/i);
  if (!returningMatch) return null;
  return returningMatch[1].split(',').map(col => col.trim());
};

const removeReturningClause = (sql) => {
  return sql.replace(/RETURNING\s+.+?$/i, '').trim();
};

module.exports = {
  query: async (text, params = []) => {
    try {
      const returningColumns = extractReturningClause(text);
      const converted = convertSqlToSqlite(text, params);
      let convertedSql = removeReturningClause(converted.sql);
      const boundParams = converted.expandedParams;

      if (text.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(convertedSql);
        const result = stmt.all(...boundParams);
        // Normalize COUNT(*) column name to match PostgreSQL behavior
        const normalizedRows = result.map(row => {
          const normalized = { ...row };
          if ('COUNT(*)' in normalized) {
            normalized.count = normalized['COUNT(*)'];
            delete normalized['COUNT(*)'];
          }
          return normalized;
        });
        return { rows: normalizedRows, command: 'SELECT' };
      } else if (/DROP\s+TRIGGER|CREATE\s+TRIGGER|CREATE\s+OR\s+REPLACE\s+FUNCTION|^\s*BEGIN\s*$|^\s*COMMIT\s*$|^\s*ROLLBACK\s*$/i.test(text)) {
        return { rows: [], command: 'DDL' };
      } else if (/^\s*INSERT/i.test(text)) {
        const stmt = db.prepare(convertedSql);
        const result = stmt.run(...boundParams);
        // If RETURNING was specified, fetch the inserted row
        if (returningColumns && result.lastInsertRowid) {
          const tableMatch = text.match(/INSERT\s+INTO\s+(\w+)/i);
          if (tableMatch) {
            const selectStmt = db.prepare(`SELECT * FROM ${tableMatch[1]} WHERE rowid = ?`);
            const rows = selectStmt.all(result.lastInsertRowid);
            return { rows, command: 'INSERT', changes: result.changes };
          }
        }
        return { rows: [], command: 'INSERT', changes: result.changes };
      } else if (/^\s*UPDATE/i.test(text)) {
        const stmt = db.prepare(convertedSql);
        const result = stmt.run(...boundParams);
        // If RETURNING was specified, fetch the updated row by the id param
        if (returningColumns && result.changes > 0) {
          const tableMatch = text.match(/UPDATE\s+(\w+)/i);
          const idParamMatch = text.match(/WHERE\s+\w*\.?id\s*=\s*\$(\d+)/i);
          if (tableMatch && idParamMatch) {
            const idValue = params[parseInt(idParamMatch[1]) - 1];
            const selectStmt = db.prepare(`SELECT * FROM ${tableMatch[1]} WHERE id = ?`);
            const rows = selectStmt.all(idValue);
            return { rows, command: 'UPDATE', changes: result.changes };
          }
        }
        return { rows: [], command: 'UPDATE', changes: result.changes };
      } else if (/^\s*DELETE/i.test(text)) {
        const stmt = db.prepare(convertedSql);
        const result = stmt.run(...boundParams);
        return { rows: [], command: 'DELETE', changes: result.changes };
      } else {
        const stmt = db.prepare(convertedSql);
        const result = stmt.run(...boundParams);
        return { rows: [], command: 'OTHER', changes: result.changes };
      }
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('UNIQUE constraint')) {
        return { rows: [], command: 'DML' };
      }
      const converted = convertSqlToSqlite(text, params);
      console.error('SQLite Query Error:\nOriginal:', text.trim(), '\nConverted:', converted.sql.trim(), '\nParams:', params, '\nError:', error.message);
      throw error;
    }
  },

  getClient: async () => {
    return {
      query: async (text, params = []) => {
        return module.exports.query(text, params);
      },
      release: () => {},
    };
  },

  db,
};
