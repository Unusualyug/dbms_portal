const nodemailer = require('nodemailer');
const HttpError = require('../utils/httpError');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
}

function createReportHtml(student, report) {
  const moduleRows = report.modules.length
    ? report.modules.map((module) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8edf1;">Module ${module.moduleNumber}: ${escapeHtml(module.title)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8edf1;text-align:right;white-space:nowrap;">${module.completedTopics}/${module.totalTopics} topics (${module.completionPercent}%)</td>
      </tr>`).join('')
    : '<tr><td colspan="2" style="padding:12px;">No module activity recorded yet.</td></tr>';
  const activityRows = report.recentActivity.length
    ? report.recentActivity.map((event) => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #e8edf1;white-space:nowrap;">${escapeHtml(formatDate(event.timestamp))}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e8edf1;">${escapeHtml(event.label)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e8edf1;">${escapeHtml(event.detail || '—')}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" style="padding:12px;">No recent activity recorded.</td></tr>';

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#25364b;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e9f0;border-radius:16px;overflow:hidden;">
    <div style="padding:24px 28px;background:#102136;color:#ffffff;">
      <div style="font-size:11px;letter-spacing:2px;color:#a8dcd3;font-weight:bold;">GMIU · DBMS LEARNING PORTAL</div>
      <h1 style="margin:12px 0 4px;font-size:24px;">Your learning report</h1>
      <p style="margin:0;color:#d2e0e7;font-size:14px;">Generated ${escapeHtml(formatDate(report.generatedAt))}</p>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 6px;font-size:16px;">Hello ${escapeHtml(student.name)},</p>
      <p style="margin:0 0 18px;color:#617287;line-height:1.6;">Here is a personal summary of your DBMS learning activity. This report is addressed only to your registered account email.</p>
      <div style="margin-bottom:18px;padding:12px 14px;background:#f5f8fa;border-radius:10px;font-size:13px;line-height:1.7;">
        <b>Student ID:</b> ${escapeHtml(student.studentId || '—')} &nbsp; · &nbsp;
        <b>Semester:</b> ${escapeHtml(student.semester || '—')} &nbsp; · &nbsp;
        <b>Class:</b> ${escapeHtml(student.classSection || '—')}
      </div>
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:7px;margin:0 0 18px;">
        <tr>
          <td style="width:50%;padding:14px;background:#eef8f5;border-radius:10px;"><div style="font-size:12px;color:#60766f;">Reward points</div><strong style="font-size:22px;color:#08796f;">${report.totalPoints.toLocaleString()}</strong></td>
          <td style="width:50%;padding:14px;background:#f1f5fb;border-radius:10px;"><div style="font-size:12px;color:#60718a;">Active learning time</div><strong style="font-size:20px;color:#294a68;">${escapeHtml(formatDuration(report.totalLearningTimeSec))}</strong></td>
        </tr>
        <tr>
          <td style="padding:14px;background:#f1f5fb;border-radius:10px;"><div style="font-size:12px;color:#60718a;">Topics opened / completed</div><strong style="font-size:20px;color:#294a68;">${report.topicsOpened} / ${report.topicsCompleted}</strong></td>
          <td style="padding:14px;background:#fff6eb;border-radius:10px;"><div style="font-size:12px;color:#8a6b48;">MCQs correct / attempted</div><strong style="font-size:20px;color:#8a5b26;">${report.correctAnswers} / ${report.questionsAttempted}</strong></td>
        </tr>
        <tr>
          <td colspan="2" style="padding:14px;background:#f5f1fb;border-radius:10px;"><div style="font-size:12px;color:#77678f;">Practicals completed / attempted</div><strong style="font-size:20px;color:#604987;">${report.practicalsCompleted} / ${report.practicalsAttempted}</strong></td>
        </tr>
      </table>
      <h2 style="margin:22px 0 8px;font-size:17px;color:#172b40;">Module progress</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">
        <thead><tr style="background:#f5f8fa;text-align:left;"><th style="padding:10px 12px;">Module</th><th style="padding:10px 12px;text-align:right;">Progress</th></tr></thead>
        <tbody>${moduleRows}</tbody>
      </table>
      <h2 style="margin:22px 0 8px;font-size:17px;color:#172b40;">Recent learning activity</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;">
        <thead><tr style="background:#f5f8fa;text-align:left;"><th style="padding:9px 12px;">When</th><th style="padding:9px 12px;">Activity</th><th style="padding:9px 12px;">Details</th></tr></thead>
        <tbody>${activityRows}</tbody>
      </table>
      <p style="margin:22px 0 0;color:#718096;font-size:12px;line-height:1.6;">Learning time counts visible, active sessions. Practical completion and practical points require verification by the configured lab. Contact your instructor if any information appears incorrect.</p>
    </div>
  </div></body></html>`;
}

function createReportText(student, report) {
  const modules = report.modules.map((module) => `Module ${module.moduleNumber}: ${module.completedTopics}/${module.totalTopics} topics (${module.completionPercent}%)`).join('\n') || 'No module activity recorded yet.';
  const activity = report.recentActivity.map((event) => `${formatDate(event.timestamp)} — ${event.label}${event.detail ? `: ${event.detail}` : ''}`).join('\n') || 'No recent activity recorded.';
  return [
    `Hello ${student.name},`,
    '',
    `Your DBMS learning report — ${formatDate(report.generatedAt)}`,
    `Student ID: ${student.studentId || '—'} | Semester: ${student.semester || '—'} | Class: ${student.classSection || '—'}`,
    `Points: ${report.totalPoints} | Active learning time: ${formatDuration(report.totalLearningTimeSec)}`,
    `Topics opened/completed: ${report.topicsOpened}/${report.topicsCompleted}`,
    `MCQs correct/attempted: ${report.correctAnswers}/${report.questionsAttempted}`,
    `Practicals completed/attempted: ${report.practicalsCompleted}/${report.practicalsAttempted}`,
    '', 'Module progress:', modules, '', 'Recent learning activity:', activity,
  ].join('\n');
}

async function sendStudentReportEmail(student, report) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new HttpError(503, 'Email is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASSWORD to the server .env first.');
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const from = process.env.REPORT_FROM_EMAIL || SMTP_USER;
  const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
  await transporter.sendMail({
    from,
    to: student.email,
    subject: `Your DBMS learning report — ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(report.generatedAt)}`,
    text: createReportText(student, report),
    html: createReportHtml(student, report),
  });
}

module.exports = { sendStudentReportEmail };
