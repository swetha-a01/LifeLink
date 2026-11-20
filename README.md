# LifeLink — Blood Donor Matching and Blood Request Management System

**LifeLink** is a comprehensive full-stack web application designed to connect voluntary blood donors with individuals and hospitals in urgent need of blood transfusions. Built on an MVC architecture with Node.js, Express, MongoDB, and modern vanilla JavaScript with Bootstrap 5, LifeLink allows a single user account to seamlessly act as both a blood requester and a voluntary blood donor, while enforcing rigorous administrative oversight, match compatibility scoring, and appointment scheduling.

---

## 1. Problem Statement

Timely access to safe blood transfusions is one of the most critical challenges in emergency healthcare. Traditional blood-seeking methods rely on unstructured social media posts, word-of-mouth phone chains, or fragmented donor contact books. This leads to:
- High response latency during medical emergencies.
- Incompatibility between requesters and potential donors.
- Lack of centralized verification, leading to spam or unreliable donors.
- Difficulty finding operational blood donation centres and coordinating appointment slots.

LifeLink addresses these challenges through a unified platform featuring automated blood group compatibility matching, admin-verified donor profiles, real-time in-app emergency alerts, blood donation centre directories, and donation appointment scheduling.

---

## 2. Objectives

- **Unified User Experience**: Provide single-account capability for both requesting blood and registering as a voluntary donor.
- **Rule-Based Compatibility Matching**: Calculate match compatibility based on exact ABO/Rh blood groups, voluntary availability, verification status, and geographical area.
- **Administrative Verification**: Prevent unvetted donor listings through an administrative review workflow (PENDING, VERIFIED, REJECTED, SUSPENDED).
- **Emergency Notification System**: Automatically alert matched donors and requesters during emergency and normal request workflows.
- **Centre Directory & Appointment Scheduling**: Enable verified donors to discover accredited blood centres and schedule appointments without conflicting bookings.
- **High Security & Data Integrity**: Prevent privilege escalation, enforce strict authorization checks, hash sensitive passwords with bcrypt, and sanitize API responses.

---

## 3. Technology Stack

| Layer | Technologies / Libraries |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, Bootstrap 5.3.2, Bootstrap Icons, JavaScript (ES6+), jQuery 3.7.1 |
| **Backend** | Node.js, Express.js 4.21.0 |
| **Database** | MongoDB 6.0+, Mongoose 8.6.0 ODM |
| **Authentication & Security** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors`, `express-rate-limit` |
| **Logging & Dev Tools** | `morgan`, `nodemon`, `dotenv` |

---

## 4. Key Features & Completed Modules

### Authentication & Account Security (Phases 1 & 2)
- Secure registration and login with bcryptjs password hashing.
- Stateless JWT issuance with configurable expiry (`JWT_EXPIRES_IN`).
- Server-side rate limiting on `/api/*` endpoints to thwart brute-force attacks.
- Secure HTTP headers via Helmet and CORS configuration.

### User & Donor Profiles (Phases 3 & 4)
- Comprehensive user dashboard with statistics and quick navigation.
- Dedicated Donor Profile registration (Blood Group, Area, City, Availability status).
- 90-day donation cooldown eligibility validation (`isDonorEligible`).

### Blood Request Management (Phase 5)
- Requesters can post normal, urgent, or emergency blood requests.
- Requesters can view historical requests and safely cancel active requests.

### Donor Matching Engine & Response Flow (Phases 6 & 7)
- Automated rule-based matching algorithm evaluating blood group, availability, verified status, and location.
- Matched donors can review request details and either ACCEPT or REJECT.
- Rejection of response to cancelled or completed requests; non-matched donor response prevention.

### In-App Notifications & Emergency Alerts (Phase 8)
- Real-time in-app notification center for request updates, matches, approvals, and appointments.
- Unread counter in navigation bar with mark-as-read functionality.
- Anti-spam deduplication logic preventing redundant notifications.

### Admin Portal & Verification System (Phase 9)
- Dedicated Administrator Dashboard (`/admin/dashboard.html`) restricted by `adminOnly` middleware.
- Metrics overview (Users, Pending Donors, Verified Donors, Active Requests).
- Admin verification workflow for voluntary donors (`VERIFY`, `REJECT`, `SUSPEND`).
- User account status management (suspending/reactivating accounts; self-deactivation protection).

### Blood Donation Centres Directory (Phase 10 — Part A & D)
- MongoDB-backed directory of blood donation centres.
- Filtering by city and area.
- Responsive centre cards with location, contact info, operating hours, and supported blood groups.
- Repeatable, idempotent seed script (`server/utils/seedCentres.js`).

### Donation Appointment Scheduling (Phase 10 — Part B, E, F & G)
- Verified and available voluntary donors can schedule appointments at active centres.
- Past-date rejection and strict 24-hour time validation (`HH:MM`).
- Conflict detection preventing double-booking by the same donor on the same date/time.
- Ownership-enforced appointment listing and safe cancellation (status updated to `CANCELLED`, records retained).
- Compact appointment widget on user dashboard displaying next upcoming visit.
- Administrator endpoint (`PATCH /api/admin/appointments/:id/complete`) to mark appointments completed and update donor cooldowns.

---

## 5. System Architecture Overview

LifeLink follows the Model-View-Controller (MVC) pattern:

```
[ Client Browser (HTML5 + Bootstrap 5 + jQuery) ]
                     │  HTTP / JSON + JWT Bearer Token
                     ▼
[ Express.js Server (server/app.js) ]
  ├── 1. Helmet (Security Headers)
  ├── 2. CORS (Cross-Origin Policy)
  ├── 3. express.json() & express.urlencoded()
  ├── 4. Static File Server (client/)
  ├── 5. Rate Limiter (/api/*)
  ├── 6. Authentication Middleware (protect, adminOnly)
  ├── 7. Controllers & Business Logic
  └── 8. Mongoose ODM ──▶ [ MongoDB Database (lifelink) ]
```

---

## 6. Project Directory Structure

```
lifelink/
├── client/                     # Static frontend files served by Express
│   ├── admin/                  # Admin portal pages
│   │   └── dashboard.html      # Admin control panel
│   ├── css/                    # CSS stylesheets
│   │   ├── style.css           # Global theme styles
│   │   └── dashboard.css       # Dashboard UI styles
│   ├── js/                     # Client-side scripts
│   │   ├── admin.js            # Admin portal controller
│   │   ├── api.js              # Centralized jQuery AJAX wrapper
│   │   ├── appointments.js     # User appointments management
│   │   ├── auth.js             # Client session & route guards
│   │   ├── centres.js          # Blood centres directory controller
│   │   ├── dashboard.js        # User dashboard controller
│   │   ├── donor.js            # Donor profile controller
│   │   ├── matches.js          # Donor matches controller
│   │   ├── notifications.js    # Notification center controller
│   │   ├── profile.js          # User profile controller
│   │   ├── request.js          # Create blood request controller
│   │   └── requests.js         # Blood requests management
│   ├── user/                   # User dashboard views
│   │   ├── appointments.html   # Scheduled appointments page
│   │   ├── centres.html        # Blood centres directory page
│   │   ├── dashboard.html      # Main user dashboard
│   │   ├── donations.html      # Donation history page
│   │   ├── donor.html          # Voluntary donor registration
│   │   ├── matches.html        # Donor matches view
│   │   ├── notifications.html  # In-app notifications
│   │   ├── profile.html        # Account profile editor
│   │   ├── request.html        # Post new blood request
│   │   └── requests.html       # Track blood requests
│   ├── index.html              # Public landing page
│   ├── login.html              # Authentication login page
│   └── register.html           # Account registration page
├── scratch/                    # Testing scripts
│   └── run_tests.js            # Complete automated regression suite (71 tests)
├── server/                     # Backend application code
│   ├── config/                 # Database & environment configurations
│   ├── controllers/            # Express controllers (auth, donor, centre, appt, etc.)
│   ├── middleware/             # Security, auth, error, and rate-limiting middleware
│   ├── models/                 # Mongoose schemas (User, DonorProfile, Appointment, etc.)
│   ├── routes/                 # Express API route declarations
│   ├── utils/                  # Matching algorithm, seeders, and response helpers
│   ├── app.js                  # Configured Express application
│   └── server.js               # HTTP server listener
├── .env.example                # Safe environment configuration template
├── .gitignore                  # Git ignore rules
├── package.json                # Project dependencies & scripts
└── README.md                   # System documentation
```

---

## 7. Setup & Installation

### Prerequisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)
- **MongoDB** (Local instance running at `mongodb://localhost:27017` or a MongoDB Atlas URI)

### Step 1: Clone or Navigate to the Repository
```bash
cd lifelink
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Configuration
Copy the provided `.env.example` to create your `.env` file:
```bash
cp .env.example .env
```
Ensure your `.env` contains appropriate settings:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/lifelink
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5000
```

### Step 4: Seed Demo Blood Centres
Seed the demo blood donation centres into MongoDB:
```bash
npm run seed:centres
```
*Note: This script is idempotent and safe to run multiple times without creating duplicate records.*

---

## 8. Running the Application

### Development Mode (with Nodemon Auto-Reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Accessing the Web Application
Open your browser and navigate to:
```
http://localhost:5000
```
- **Landing Page**: `http://localhost:5000/`
- **Login**: `http://localhost:5000/login.html`
- **Register**: `http://localhost:5000/register.html`
- **User Dashboard**: `http://localhost:5000/user/dashboard.html`
- **Blood Centres Directory**: `http://localhost:5000/user/centres.html`
- **Appointments Management**: `http://localhost:5000/user/appointments.html`
- **Admin Portal**: `http://localhost:5000/admin/dashboard.html` *(requires an account with `role: "ADMIN"`)*

---

## 9. Comprehensive API Endpoint Summary

### Public & Authentication Endpoints
| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | Service health status check |
| `POST` | `/api/auth/register` | None | Register new user account (`role: USER`) |
| `POST` | `/api/auth/login` | None | Authenticate user and issue JWT token |
| `GET` | `/api/auth/me` | JWT | Get authenticated user profile |
| `POST` | `/api/auth/logout` | None | Acknowledge user logout |

### Donor Profiles & Requests
| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/donor/profile` | JWT | Create or update voluntary donor profile |
| `GET` | `/api/donor/profile` | JWT | Get current user's voluntary donor profile |
| `POST` | `/api/requests` | JWT | Post a new blood request |
| `GET` | `/api/requests` | JWT | List current user's blood requests |
| `GET` | `/api/requests/:id` | JWT | Get specific blood request details |
| `PATCH` | `/api/requests/:id/cancel` | JWT | Cancel active blood request (owner only) |

### Matches & Notifications
| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/matches/generate/:requestId` | JWT | Run matching algorithm for a blood request |
| `GET` | `/api/matches` | JWT | Retrieve matches relevant to user |
| `PATCH` | `/api/matches/:id/respond` | JWT | Accept or decline a match (matched donor only) |
| `GET` | `/api/notifications` | JWT | List notifications for authenticated user |
| `PATCH` | `/api/notifications/:id/read` | JWT | Mark a notification as read |

### Blood Donation Centres (Phase 10)
| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/centres` | JWT | List all active blood donation centres (supports `?city=`) |
| `GET` | `/api/centres/:id` | JWT | Get specific active centre details |

### Appointments Management (Phase 10)
| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/appointments` | JWT | Book donation appointment (verified donors only) |
| `GET` | `/api/appointments` | JWT | List current user's appointments |
| `GET` | `/api/appointments/:id` | JWT | Get details of a specific appointment (owner only) |
| `PATCH` | `/api/appointments/:id/cancel` | JWT | Cancel an appointment (owner only) |

### Administrator Endpoints (Phase 9 & 10)
| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/dashboard` | JWT + ADMIN | Platform statistics & system overview metrics |
| `GET` | `/api/admin/donors/pending` | JWT + ADMIN | List donor profiles awaiting verification |
| `GET` | `/api/admin/donors` | JWT + ADMIN | List all registered donor profiles |
| `PATCH` | `/api/admin/donors/:id/verify` | JWT + ADMIN | Verify, reject, or suspend a donor profile |
| `GET` | `/api/admin/users` | JWT + ADMIN | List registered user accounts |
| `PATCH` | `/api/admin/users/:id/status` | JWT + ADMIN | Suspend or reactivate user account |
| `GET` | `/api/admin/appointments` | JWT + ADMIN | Overview of all donation appointments across centres |
| `PATCH` | `/api/admin/appointments/:id/complete` | JWT + ADMIN | Mark donation appointment completed & update cooldown |

---

## 10. Automated Testing & Verification

The test suite thoroughly verifies all business logic, RBAC security guards, conflict checking, and edge cases.

To execute the test suite:
```bash
npm test
```
*(Or run `node scratch/run_tests.js`)*

### Current Test Suite Results
- **Phase 6 Tests (Blood Requests & Cancellation)**: 8/8 PASS
- **Phase 7 Tests (Donor Response & Flow)**: 10/10 PASS
- **Phase 8 Tests (Notifications & Emergency Alerts)**: 12/12 PASS
- **Phase 9 Tests (Admin Portal & Donor Verification)**: 18/18 PASS
- **Phase 10 Tests (Centres, Appointments & Security)**: 23/23 PASS
- **Total Tests Executed**: 71
- **Passed**: 71 (100%)
- **Failed**: 0
- **Skipped**: 0

---

## 11. Known Limitations & Academic Project Scope

1. **SMS & Email Gateways**: Real-world telecom integration (Twilio / AWS SNS / SendGrid) is simulated via in-app notifications.
2. **GPS & Real-Time Tracking**: Geographical matching relies on standardized area/city strings rather than live GPS telemetry.
3. **Payment & Billing**: LifeLink adheres to non-commercial voluntary blood donation ethics; there are no financial gateways.

---

## 12. Academic Disclaimer

> **ACADEMIC CAPSTONE PROTOTYPE DISCLAIMER:**
> This software is developed solely for educational and academic demonstration purposes as a BCA Capstone Project. LifeLink facilitates digital communication between potential donors and requesters. Actual blood compatibility, infectious disease screenings, donor suitability, and clinical transfusion safety must be independently verified by certified healthcare professionals and accredited blood banks.
