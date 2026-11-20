
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const config = require("../config/config");
const Match = require("../models/Match");
const EmailAction = require("../models/EmailAction");

const enabled = config.email.enabled;

const transporter =
  enabled &&
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      })
    : null;

// Escape HTML values before inserting them into email templates.
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

// Build links to the request page.
async function getRequestActionUrls(request, matchId, donorUserId) {
  const baseUrl = config.publicAppUrl;

  const requestId = request?._id || request?.id;
  const requestsPage = `${baseUrl}/user/respond-to-request.html`;

  if (!requestId) {
    return {
      acceptUrl: requestsPage,
      declineUrl: requestsPage,
    };
  }

  return createEmailActionUrls(matchId, donorUserId, requestsPage);
}

async function createEmailActionUrls(matchId, donorUserId, pageUrl) {
  const match = await Match.findOne({ _id: matchId, donorUserId });

  if (!match) {
    console.error("Donor email skipped: matching record is missing.");
    return { acceptUrl: pageUrl, declineUrl: pageUrl };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  await EmailAction.create({
    tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
    matchId: match._id,
    donorUserId: match.donorUserId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  const accept = new URL(pageUrl);
  accept.searchParams.set("token", rawToken);
  accept.searchParams.set("action", "accept");

  const decline = new URL(pageUrl);
  decline.searchParams.set("token", rawToken);
  decline.searchParams.set("action", "reject");

  return { acceptUrl: accept.toString(), declineUrl: decline.toString() };
}

// HTML buttons shown in the donor's email.
function emailActionButtons({ acceptUrl, declineUrl }) {
  return `
    <div style="margin:24px 0;text-align:center">
      <a href="${escapeHtml(acceptUrl)}"
         style="display:inline-block;background:#15803d;color:#ffffff;
         padding:12px 20px;text-decoration:none;border-radius:6px;
         font-weight:bold;margin:4px">
        Accept Request
      </a>

      <a href="${escapeHtml(declineUrl)}"
         style="display:inline-block;background:#b91c1c;color:#ffffff;
         padding:12px 20px;text-decoration:none;border-radius:6px;
         font-weight:bold;margin:4px">
        Decline
      </a>
    </div>
  `;
}

// Send email without allowing SMTP errors to break the main workflow.
async function sendEmail({ to, subject, text, html }) {
  if (!enabled) {
    console.error(
      "LifeLink email skipped: EMAIL_ENABLED is not true."
    );
    return false;
  }

  if (!transporter) {
    console.error(
      "LifeLink email skipped: SMTP configuration is incomplete."
    );
    console.error("SMTP configuration is incomplete.");
    return false;
  }

  if (typeof to !== "string" || !to.trim()) {
    console.error(
      "LifeLink email skipped: recipient email is missing."
    );
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: config.email.from,
      to: to.trim(),
      subject,
      text,
      html,
    });

    console.log("LifeLink email accepted by SMTP server.");
    console.log("Subject:", subject);
    console.log("Message ID:", info.messageId);
    console.log("Accepted recipients:", info.accepted);
    console.log("Rejected recipients:", info.rejected);

    return true;
  } catch (error) {
    console.error("LifeLink email failed.");
    console.error("Error code:", error.code || "Unknown");
    console.error("Error message:", error.message);

    return false;
  }
}

// Notify a donor when a matching blood request is created.
async function sendDonorRequestEmail({ donor, request, matchId }) {
  if (!donor?.email || !request) {
    console.error(
      "Donor email skipped: donor email or request is missing."
    );
    return false;
  }

  const donorName = escapeHtml(donor.name || "Donor");
  const bloodGroup = escapeHtml(
    request.bloodGroup || "Not specified"
  );
  const hospital = escapeHtml(
    request.hospitalName || "See LifeLink"
  );
  const area = escapeHtml(request.area || "Not specified");
  const priority = escapeHtml(request.priority || "NORMAL");
  const unitsRequired = escapeHtml(
    request.unitsRequired ?? "Not specified"
  );

  const { acceptUrl, declineUrl } =
    await getRequestActionUrls(request, matchId, donor._id || donor.id);

  return sendEmail({
    to: donor.email,

    subject:
      request.priority === "EMERGENCY"
        ? "URGENT: A matching blood request is on LifeLink"
        : "LifeLink: A blood request matches your donor profile",

    text:
      `Hello ${donor.name || "Donor"},\n\n` +
      "A blood request matching your profile has been posted.\n" +
      `Blood group: ${request.bloodGroup || "Not specified"}\n` +
      `Units required: ${request.unitsRequired ?? "Not specified"}\n` +
      `Hospital: ${request.hospitalName || "See LifeLink"}\n` +
      `Area: ${request.area || "Not specified"}\n` +
      `Priority: ${request.priority || "NORMAL"}\n\n` +
      `Review request: ${acceptUrl}\n` +
      `Decline request: ${declineUrl}\n\n` +
      "Sign in to LifeLink to review the request and respond.\n" +
      "A match does not guarantee medical eligibility or compatibility.\n\n" +
      "The LifeLink Team",

    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;
                  margin:auto;color:#263247;line-height:1.6">

        <h2 style="color:#b91c1c">
          LifeLink Blood Donation
        </h2>

        <p>Hello ${donorName},</p>

        <p>
          A blood request matching your donor profile has been posted.
        </p>

        <div style="padding:16px;background:#fff5f5;border-radius:8px">
          <p><b>Blood group:</b> ${bloodGroup}</p>
          <p><b>Units required:</b> ${unitsRequired}</p>
          <p><b>Hospital:</b> ${hospital}</p>
          <p><b>Area:</b> ${area}</p>
          <p><b>Priority:</b> ${priority}</p>
        </div>

        ${emailActionButtons({ acceptUrl, declineUrl })}

        <p>
          Sign in to LifeLink to review the request and decide whether
          to respond.
        </p>

        <p style="font-size:12px;color:#64748b">
          This is a potential match, not confirmation of medical
          eligibility, compatibility, or a completed donation.
        </p>

        <p>Thank you,<br>The LifeLink Team</p>
      </div>
    `,
  });
}

// Notify the requester when a donor accepts a match.
async function sendRequesterAcceptedEmail({
  requester,
  donor,
  request,
}) {
  if (!requester?.email || !request) {
    console.error(
      "Requester email skipped: requester email or request is missing."
    );
    return false;
  }

  const requesterName = escapeHtml(requester.name || "there");
  const donorName = escapeHtml(
    donor?.name || "A matched donor"
  );
  const bloodGroup = escapeHtml(
    request.bloodGroup || "your requested blood group"
  );

  return sendEmail({
    to: requester.email,

    subject:
      "LifeLink: A donor has accepted your blood request",

    text:
      `Hello ${requester.name || "there"},\n\n` +
      `${donor?.name || "A matched donor"} has accepted your blood request.\n` +
      `Blood group: ${request.bloodGroup || "Not specified"}\n\n` +
      "Please sign in to LifeLink to review the match and coordinate next steps.\n\n" +
      "The LifeLink Team",

    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;
                  margin:auto;color:#263247;line-height:1.6">

        <h2 style="color:#15803d">
          Good news from LifeLink!
        </h2>

        <p>Hello ${requesterName},</p>

        <p>
          <b>${donorName}</b> has accepted your blood request.
        </p>

        <p><b>Requested blood group:</b> ${bloodGroup}</p>

        <p>
          Sign in to LifeLink to review the match and coordinate
          next steps.
        </p>

        <p style="font-size:12px;color:#64748b">
          Acceptance does not guarantee a completed donation or
          medical eligibility. Please confirm arrangements directly.
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
