# Assignment 1 – AI-Driven Adaptive Quiz System
### EASA Flight Dispatcher Knowledge Assessment

---

## Overview

An AI-powered, adaptive quiz platform built for EASA Flight Dispatcher certification preparation. The system uses the Anthropic Claude API to dynamically generate questions, evaluate answers, and provide educational feedback — all in real time.

---

## Features

| Feature | Description |
|---|---|
| **AI Question Generation** | Each question is generated live by Claude, tailored to the current difficulty level |
| **Adaptive Difficulty** | Difficulty scales up if the user answers 2 consecutive questions correctly, and scales down after 2 consecutive wrong answers |
| **AI Answer Evaluation** | Claude evaluates the submitted answer and returns an explanation whether correct or not |
| **10 Difficulty Levels** | Levels 1–2 (basic definitions) → Levels 9–10 (expert regulatory edge cases) |
| **Topic Coverage** | Aviation Navigation, Aviation Meteorology, Flight Dispatcher (EASA) |
| **Final Report** | Score percentage, final level attained, and per-topic performance breakdown |

---

## Tech Stack

- **Frontend**: React (JSX) with hooks
- **Styling**: Inline styles + CSS keyframe animations (no external CSS library)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`) via `fetch`
- **Fonts**: Google Fonts — Orbitron (display), Exo 2 (body)

---

## Project Structure

```
assignment1/
├── src/
│   └── QuizApp.jsx        ← Main React component (self-contained)
├── demo/
│   └── index.html         ← Standalone HTML demo (open in browser, no install needed)
└── README.md
```

---

## Local Setup (React)

### Prerequisites
- Node.js 18+
- An Anthropic API key → https://console.anthropic.com

### Steps

```bash
# 1. Create a new React app
npx create-react-app flight-quiz
cd flight-quiz

# 2. Replace src/App.js content with QuizApp.jsx source
#    (or copy QuizApp.jsx into src/ and import it in App.js)

# 3. Start the dev server
npm start
```

> **API Key**: The app calls the Anthropic API directly from the browser.
> In a production app, proxy calls through a backend to keep the key secret.
> For local testing, the key is handled by the Claude.ai artifact environment automatically.

---

## Working Demo

Open `demo/index.html` directly in any modern browser — **no installation required**.

The demo is a fully self-contained single HTML file that:
- Embeds React via CDN
- Includes all quiz logic and UI
- Calls the Anthropic API live

---

## How Adaptive Difficulty Works

```
Start at Level 1
      │
      ▼
 Answer question
      │
  ┌───┴───┐
Correct?  Wrong?
  │         │
Track last 2 answers
  │
2 correct in a row → Level UP   (max 10)
2 wrong   in a row → Level DOWN (min 1)
Otherwise          → Stay same level
      │
      ▼
 After 10 questions → Show Results
```

---

## Quiz Flow

```
Intro Screen
    │
    ▼
[Claude generates Q at current level]
    │
    ▼
User selects answer
    │
    ▼
[Claude evaluates answer + generates feedback]
    │
    ▼
Show result (✅/❌) + explanation
    │
    ▼
Adapt level → Next question
    │
    ▼ (after 10 questions)
Results Screen — Score % + Final Level + Topic Breakdown
```

---

## Evaluation Criteria Coverage

| Criterion | How it's addressed |
|---|---|
| **System design** | Clean separation: API layer, adaptive logic, UI components |
| **Code quality** | Documented, modular React with hooks; error handling on all API calls |
| **Use of AI tools** | Claude used for question generation, answer evaluation, and feedback |
| **User experience** | Animated transitions, clear feedback, topic badges, progress bar |
| **Automation logic** | Fully automated difficulty adaptation without any manual question bank |
| **Creativity** | Aviation-themed cockpit UI; AI generates unlimited unique questions |
| **Scalability** | Stateless API calls; easy to extend topics or add more levels |

---

## Sample Question (Level 3 — Navigation)

> **Question**: Which type of airspace requires a clearance from ATC before entry?
>
> A) Class G airspace
> B) Class E airspace
> C) Class C airspace ✅
> D) Class F airspace
>
> **Feedback**: Class C airspace requires a clearance from ATC before entry. Pilots must establish two-way radio communication and receive an explicit clearance. Class G and E are uncontrolled or partially controlled and don't require clearance.

---

*Built using React + Anthropic Claude API for EASA Flight Dispatcher assessment.*
