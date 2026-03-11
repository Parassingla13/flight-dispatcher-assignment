# Assignment 2 – Workflow Explanation
## UserBase: Database System with User Login & Record Management

---

## System Overview

UserBase is a full-cycle user management platform covering four automated workflows: Excel-driven bulk import, authenticated self-service record management, OTP-verified registration, and first-login security enforcement. All workflows are driven by automation with zero manual credential management.

---

## Step 1 – Data Import Workflow

```
Excel File (.xlsx)
       │
       ▼
  Parse with SheetJS
  (reads rows → JSON)
       │
       ▼
  Validate each row
  (firstName, lastName, email required)
       │
   ┌───┴───────────────────┐
Email exists?           Valid row
   │ YES                   │ NO
   ▼                       ▼
Skip row           Auto-generate credentials
(report reason)    ┌─────────────────────┐
                   │ username = first     │
                   │ initial + last name  │
                   │ + 2-digit random num │
                   │                      │
                   │ password = 10-char   │
                   │ mixed-case + digits  │
                   │ + special chars      │
                   └─────────────────────┘
                          │
                          ▼
                   Insert into database
                   (mustChangePassword = TRUE)
                          │
                          ▼
                   Simulate email to user
                   (username + temp password)
                          │
                          ▼
                   Show import results table
                   (created / skipped / reason)
```

**In production:** Replace `sendEmail()` stub with SendGrid or Nodemailer. Replace in-memory DB with PostgreSQL using the provided `database_schema.sql`.

---

## Step 2 – User Access Workflow

```
User opens app
      │
      ▼
Login screen
(username OR email + password)
      │
   ┌──┴──────────────────┐
Wrong credentials     Correct
      │                   │
   Show error        mustChangePassword?
                     │ YES         │ NO
                     ▼             ▼
              Force password    Dashboard
              change screen
                     │
              [Step 4 handled here]

──── Once logged in ────────────────────────────────

  My Profile page allows the user to:
  ┌──────────────────────────────────────┐
  │  VIEW    → see all their own details │
  │  EDIT    → update name, phone, dept  │
  │  DELETE  → hard-delete their account │
  └──────────────────────────────────────┘

  Admin/Manager additionally sees:
  ┌──────────────────────────────────────────────┐
  │  Users page → view, edit, delete any user    │
  │  Import page → bulk import from Excel        │
  │  Dashboard  → stats + recent user list       │
  └──────────────────────────────────────────────┘
```

---

## Step 3 – New User Registration with OTP Workflow

```
Registration Form
(firstName, lastName, email, phone, department)
       │
       ▼
  Client-side validation
  (required fields + email format + duplicate check)
       │
       ▼
  Generate 6-digit OTP
  Store in DB: { email, otp, data, expires: now+10min }
       │
       ▼
  Send OTP email to user
  (in demo: OTP shown in UI for testing)
       │
       ▼
  OTP Verification Screen
  (user enters 6-digit code)
       │
   ┌───┴──────────────────────────────┐
Expired/Wrong OTP              Correct OTP
       │                              │
  Show error                  Delete OTP from DB
  (allow resend)              Create user account
                              Auto-generate credentials
                              Send credentials email
                                      │
                                      ▼
                              Redirect to Login
                              (with success message)
```

**OTP Security rules:**
- Expires in 10 minutes
- Single-use (deleted after successful verification)
- Can be resent (generates new OTP, old one invalidated)

---

## Step 4 – First Login Security Workflow

```
User logs in with temporary credentials
              │
              ▼
      Auth.login() succeeds
              │
     mustChangePassword = TRUE?
              │ YES
              ▼
   Force redirect to Change Password screen
   (cannot access any other page until done)
              │
   User enters new password + confirm
              │
   Validation:
   ┌──────────────────────────────────┐
   │  • Min 8 characters              │
   │  • Passwords must match          │
   │  • Visual strength meter shown   │
   └──────────────────────────────────┘
              │
              ▼
   Hash new password, store in DB
   Set mustChangePassword = FALSE
              │
              ▼
   Redirect to Dashboard ✓
```

---

## Automation Summary

| Task | Automation |
|---|---|
| Username generation | Auto: `{firstInitial}{lastName}{2-digit random}` |
| Password generation | Auto: 10-char mixed alphanumeric + special chars |
| Email notification | Auto: triggered on create / OTP / import |
| OTP generation | Auto: 6-digit, 10-minute expiry, single-use |
| First-login check | Auto: enforced at every login, cannot be bypassed |
| Credential uniqueness | Auto: checked against DB before assignment |

---

## Technology Stack

| Layer | Technology | Production Recommendation |
|---|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JS | React / Vue for larger teams |
| Database | In-memory JS object | PostgreSQL 15+ (schema provided) |
| Excel parsing | SheetJS (CDN) | Same (or server-side with exceljs) |
| Email service | `console.log` simulation | SendGrid / Nodemailer / AWS SES |
| Password hashing | Base64 (demo only) | bcrypt (rounds=12) |
| Session tokens | Random string | JWT or secure HTTP-only cookies |
| OTP storage | In-memory | Redis with TTL or DB table |

---

## Security Considerations (Production Upgrades)

1. **Password hashing** — replace `btoa` with `bcrypt(password, 12)` server-side
2. **Sessions** — store in DB/Redis, use `HttpOnly` secure cookies, not localStorage
3. **OTP** — rate-limit OTP requests (max 3 per hour per email)
4. **API keys** — never expose email service keys in frontend; all sensitive calls go through a backend API
5. **Input sanitisation** — validate and sanitise all inputs server-side
6. **HTTPS** — enforce TLS in production

---

## Files Included

| File | Description |
|---|---|
| `src/user-management-system.html` | Complete working application (open in browser) |
| `docs/database_schema.sql` | Full PostgreSQL schema with indexes, triggers, sample queries |
| `docs/workflow_explanation.md` | This document |
| `sample-data/sample_users.xlsx` | Formatted Excel file ready for import |
| `README.md` | Setup and usage guide |
