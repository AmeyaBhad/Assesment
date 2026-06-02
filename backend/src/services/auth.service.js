const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendWelcomeEmail } = require('../utils/email');
const { logActivity, ACTIONS } = require('./activityLog.service');
const logger = require('../utils/logger');

const register = async ({ name, email, password, role }) => {
  // Check if user exists
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const id = uuidv4();

  const result = await db.query(
    `INSERT INTO users (id, name, email, password, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, created_at`,
    [id, name, email, hashedPassword, role]
  );

  const user = result.rows[0];

  // Log activity (non-blocking)
  await logActivity({
    userId: user.id,
    action: ACTIONS.USER_REGISTERED,
    details: { name, email, role },
  });

  // Send welcome email (non-blocking)
  sendWelcomeEmail({ email, name, role }).catch((e) =>
    logger.warn('Welcome email failed:', e.message)
  );

  return user;
};

const login = async ({ email, password }) => {
  const result = await db.query(
    'SELECT id, name, email, password, role, is_active FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const user = result.rows[0];

  if (!user.is_active) {
    const error = new Error('Account is deactivated');
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const payload = { userId: user.id, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const expiresAtStr = expiresAt.toISOString(); // Convert to ISO string for SQLite compatibility
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
    [uuidv4(), user.id, refreshToken, expiresAtStr]
  );

  await logActivity({
    userId: user.id,
    action: ACTIONS.USER_LOGIN,
    details: { email },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

const refreshAccessToken = async (refreshToken) => {
  // Verify the token
  const decoded = verifyRefreshToken(refreshToken);

  // Check if token exists in DB
  const result = await db.query(
    `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
    [refreshToken]
  );

  if (result.rows.length === 0) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  const userResult = await db.query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [decoded.userId]
  );

  if (userResult.rows.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 401;
    throw error;
  }

  const user = userResult.rows[0];
  const newAccessToken = generateAccessToken({ userId: user.id, role: user.role });

  return { accessToken: newAccessToken, user };
};

const logout = async (userId, refreshToken) => {
  if (refreshToken) {
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  } else {
    // Invalidate all refresh tokens for user
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  }

  await logActivity({
    userId,
    action: ACTIONS.USER_LOGOUT,
    details: {},
  });
};

module.exports = { register, login, refreshAccessToken, logout };
