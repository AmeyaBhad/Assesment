const nodemailer = require('nodemailer');
const logger = require('./logger');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send lead assignment notification to an agent
 */
const sendLeadAssignmentEmail = async ({ agentEmail, agentName, leadName, leadId }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email credentials not configured. Skipping email notification.');
    return { skipped: true, reason: 'Email not configured' };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || `Lead Management <${process.env.EMAIL_USER}>`,
      to: agentEmail,
      subject: `New Lead Assigned: ${leadName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 20px; text-align: center;">
            <h1 style="color: #e94560; margin: 0;">Lead Management</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>Hello, ${agentName}!</h2>
            <p>A new lead has been assigned to you.</p>
            <div style="background: white; border-left: 4px solid #e94560; padding: 15px; margin: 20px 0;">
              <strong>Lead Name:</strong> ${leadName}<br/>
              <strong>Lead ID:</strong> ${leadId}
            </div>
            <p>Please log in to the Lead Management System to view and manage this lead.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/leads/${leadId}" 
               style="background: #e94560; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">
              View Lead
            </a>
          </div>
          <div style="padding: 15px; background: #1a1a2e; text-align: center; color: #666; font-size: 12px;">
            <p style="color: #aaa;">Lead Management System - Automated Notification</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Lead assignment email sent to ${agentEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Failed to send email to ${agentEmail}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email to new user
 */
const sendWelcomeEmail = async ({ email, name, role }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email credentials not configured. Skipping welcome email.');
    return { skipped: true };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || `Lead Management <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Lead Management System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 20px; text-align: center;">
            <h1 style="color: #e94560; margin: 0;">Lead Management</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>Welcome, ${name}!</h2>
            <p>Your account has been created successfully.</p>
            <p><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
            <p>You can now log in to the Lead Management System.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${email}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Failed to send welcome email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendLeadAssignmentEmail, sendWelcomeEmail };
