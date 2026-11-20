
const nodemailer = require("nodemailer");

const enabled = process.env.EMAIL_ENABLED === "true";

const transporter =
  enabled &&
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: process.env.EMAIL_SECURE === "true",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

async function sendEmail({ to, subject, text, html }) {
  if (!enabled || !transporter) {
    console.log("LifeLink email skipped: email is disabled or not configured.");
    return false;
  }

  if (typeof to !== "string" || !to.trim()) {
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: to.trim(),
      subject,
      text,
      html,
    });

    console.log("LifeLink email submitted successfully.");
    return true;
  } catch (error) {
    // Do not print credentials or allow SMTP failures to break the workflow.
    console.error("LifeLink email failed:", error.message);
    return false;
  }
}

async function sendDonorRequestEmail({ donor, request }) {
  if (!donor?.email || !request) return false;

  const donorName = escapeHtml(donor.name || "Donor");
  const bloodGroup = escapeHtml(request.bloodGroup || "Not specified");
  const hospital = escapeHtml(request.hospitalName || "See LifeLink");
  const area = escapeHtml(request.area || "Not specified");
  const priority = escapeHtml(request.priority || "NORMAL");

  return sendEmail({
    to: donor.email,
    subject:
      request.priority === "EMERGENCY"
        ? "URGENT: A matching blood request is on LifeLink"
        : "LifeLink: A blood request matches your donor profile",
    text:
      `Hello ${donor.name || "Donor"},\n\n` +
      `A blood request matching your profile has been posted.\n` +
      `Blood group: ${request.bloodGroup || "Not specified"}\n` +
      `Units required: ${request.unitsRequired ?? "Not specified"}\n` +
      `Hospital: ${request.hospitalName || "See LifeLink"}\n` +
      `Area: ${request.area || "Not specified"}\n` +
      `Priority: ${request.priority || "NORMAL"}\n\n` +
      `Please sign in to LifeLink to review the request and respond.\n` +
      `A match does not guarantee medical eligibility or compatibility.\n\n` +
      `The LifeLink Team`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#263247;line-height:1.6">
        <h2 style="color:#b91c1c">LifeLink Blood Donation</h2>
        <p>Hello ${donorName},</p>
        <p>A blood request matching your donor profile has been posted.</p>
        <div style="padding:16px;background:#fff5f5;border-radius:8px">
          <p><b>Blood group:</b> ${bloodGroup}</p>
          <p><b>Units required:</b> ${escapeHtml(request.unitsRequired ?? "Not specified")}</p>
          <p><b>Hospital:</b> ${hospital}</p>
          <p><b>Area:</b> ${area}</p>
          <p><b>Priority:</b> ${priority}</p>
        </div>
        <p>Sign in to LifeLink to review the request and decide whether to respond.</p>
        <p style="font-size:12px;color:#64748b">
          This is a potential match, not confirmation of medical eligibility,
          compatibility, or a completed donation.
        </p>
        <p>Thank you,<br>The LifeLink Team</p>
      </div>
    `,
  });
}

async function sendRequesterAcceptedEmail({ requester, donor, request }) {
  if (!requester?.email || !request) return false;

  const requesterName = escapeHtml(requester.name || "there");
  const donorName = escapeHtml(donor?.name || "A matched donor");
  const bloodGroup = escapeHtml(request.bloodGroup || "your requested blood group");

  return sendEmail({
    to: requester.email,
    subject: "LifeLink: A donor has accepted your blood request",
    text:
      `Hello ${requester.name || "there"},\n\n` +
      `${donor?.name || "A matched donor"} has accepted your blood request.\n` +
      `Blood group: ${request.bloodGroup || "Not specified"}\n\n` +
      `Please sign in to LifeLink to review the match and coordinate next steps.\n\n` +
      `The LifeLink Team`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#263247;line-height:1.6">
        <h2 style="color:#15803d">Good news from LifeLink!</h2>
        <p>Hello ${requesterName},</p>
        <p><b>${donorName}</b> has accepted your blood request.</p>
        <p><b>Requested blood group:</b> ${bloodGroup}</p>
        <p>Sign in to LifeLink to review the match and coordinate next steps.</p>
        <p style="font-size:12px;color:#64748b">
          Acceptance does not guarantee a completed donation or medical eligibility.
          Please confirm arrangements directly.
        </p>
        <p>The LifeLink Team</p>
      </div>
    `,
  });
}

module.exports = {
  sendEmail,
  sendDonorRequestEmail,
  sendRequesterAcceptedEmail,
};
