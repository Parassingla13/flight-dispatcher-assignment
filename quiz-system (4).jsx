import { useState, useEffect, useRef } from "react";

const SYSTEM_PROMPT = `You are an expert aviation examiner for EASA Flight Dispatcher certification. 
You generate adaptive quiz questions covering Aviation Navigation, Aviation Meteorology, and Flight Dispatcher concepts under the EASA framework.

When asked to generate a question for a specific level (1-10), return ONLY a valid JSON object with this exact structure:
{
  "question": "The question text",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "correct": "A",
  "explanation": "Brief explanation of the correct answer",
  "topic": "Navigation|Meteorology|Flight Dispatcher"
}

Level guidelines:
- Levels 1-2: Basic definitions and concepts (VFR, IFR, types of clouds, basic navigation terms)
- Levels 3-4: Intermediate knowledge (chart reading, weather systems, NOTAM interpretation)
- Levels 5-6: Applied knowledge (flight planning, complex meteorology, fuel calculations)
- Levels 7-8: Advanced scenarios (emergency procedures, complex airspace, severe weather decisions)
- Levels 9-10: Expert level (multi-factor decision making, regulatory edge cases, complex dispatch scenarios)

Return ONLY the JSON, no markdown, no extra text.`;

const EVAL_PROMPT = `You are an EASA aviation examiner. A student answered a quiz question.
Given the question, the correct answer, and the student's answer, provide:
1. Whether it's correct
2. A concise, educational explanation (2-3 sentences max)

Return ONLY valid JSON:
{
  "correct": true/false,
  "feedback": "Your explanation here"
}`;

async function callClaude(messages, systemPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await response.json();
  return data.content?.map(b => b.text || "").join("") || "";
}

function parseJSON(text) {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ── Visual components ──────────────────────────────────────────────

function Stars({ count = 50 }) {
  const stars = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      delay: Math.random() * 4,
    }))
  ).current;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.7)",
          animation: `twinkle 3s ${s.delay}s infinite alternate`,
        }} />
      ))}
    </div>
  );
}

function ProgressBar({ level, total = 10 }) {
  return (
    <div style={{ width: "100%", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            width: `${90 / total}%`,
            height: 6,
            borderRadius: 3,
            background: i < level ? "linear-gradient(90deg,#38bdf8,#818cf8)" : "rgba(255,255,255,0.1)",
            transition: "background 0.4s",
            boxShadow: i < level ? "0 0 8px rgba(56,189,248,0.6)" : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

function TopicBadge({ topic }) {
  const colors = {
    Navigation: { bg: "rgba(56,189,248,0.15)", border: "#38bdf8", text: "#38bdf8" },
    Meteorology: { bg: "rgba(129,140,248,0.15)", border: "#818cf8", text: "#818cf8" },
    "Flight Dispatcher": { bg: "rgba(251,191,36,0.15)", border: "#fbbf24", text: "#fbbf24" },
  };
  const c = colors[topic] || colors["Flight Dispatcher"];
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: 1, textTransform: "uppercase",
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>{topic}</span>
  );
}

// ── Main App ───────────────────────────────────────────────────────

export default function QuizApp() {
  const [screen, setScreen] = useState("intro"); // intro | quiz | result
  const [level, setLevel] = useState(1);
  const [questionNum, setQuestionNum] = useState(0);
  const [currentQ, setCurrentQ] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [finalLevel, setFinalLevel] = useState(1);
  const [error, setError] = useState(null);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;500;600&display=swap');
      @keyframes twinkle { from { opacity: 0.2 } to { opacity: 1 } }
      @keyframes fadeSlideIn { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
      @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 20px rgba(56,189,248,0.3) } 50% { box-shadow: 0 0 40px rgba(56,189,248,0.7) } }
      @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      @keyframes countUp { from { transform: scale(0.5); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #030712; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  async function loadQuestion(lvl) {
    setLoadingQ(true);
    setSelected(null);
    setFeedback(null);
    setError(null);
    setAnimIn(false);
    try {
      const raw = await callClaude([{
        role: "user",
        content: `Generate a Level ${lvl} quiz question for EASA Flight Dispatcher. Make it appropriate for difficulty level ${lvl}/10.`
      }], SYSTEM_PROMPT);
      const q = parseJSON(raw);
      if (!q) throw new Error("Invalid question format");
      setCurrentQ(q);
      setTimeout(() => setAnimIn(true), 50);
    } catch (e) {
      setError("Failed to load question. Please try again.");
    }
    setLoadingQ(false);
  }

  function startQuiz() {
    setLevel(1);
    setQuestionNum(0);
    setScore(0);
    setHistory([]);
    setScreen("quiz");
    loadQuestion(1);
  }

  async function submitAnswer(opt) {
    if (selected || loadingFeedback) return;
    setSelected(opt);
    setLoadingFeedback(true);
    const letter = opt.charAt(0);
    try {
      const raw = await callClaude([{
        role: "user",
        content: `Question: ${currentQ.question}\nCorrect answer: ${currentQ.correct}) ${currentQ.options.find(o => o.startsWith(currentQ.correct))?.slice(3)}\nStudent answered: ${opt}\nTopic: ${currentQ.topic}`
      }], EVAL_PROMPT);
      const result = parseJSON(raw);
      const isCorrect = result?.correct ?? letter === currentQ.correct;
      const fb = result?.feedback || currentQ.explanation;
      setFeedback({ correct: isCorrect, text: fb });
      if (isCorrect) setScore(s => s + 1);
      setHistory(h => [...h, {
        level, question: currentQ.question, selected: opt,
        correct: currentQ.correct, isCorrect, topic: currentQ.topic
      }]);
    } catch {
      const isCorrect = letter === currentQ.correct;
      setFeedback({ correct: isCorrect, text: currentQ.explanation });
      if (isCorrect) setScore(s => s + 1);
    }
    setLoadingFeedback(false);
  }

  function nextQuestion() {
    const nextNum = questionNum + 1;
    if (nextNum >= 10) {
      const fl = Math.min(10, Math.max(1, Math.round(score * 10 / 10) + (score > 5 ? 1 : 0)));
      setFinalLevel(fl);
      setScreen("result");
      return;
    }
    setQuestionNum(nextNum);
    // Adaptive level logic
    const recentHistory = [...history];
    let newLevel = level;
    if (recentHistory.length >= 2) {
      const last2 = recentHistory.slice(-2);
      const correct = last2.filter(h => h.isCorrect).length;
      if (correct === 2 && level < 10) newLevel = level + 1;
      else if (correct === 0 && level > 1) newLevel = level - 1;
    }
    setLevel(newLevel);
    loadQuestion(newLevel);
  }

  // ── SCREENS ──

  if (screen === "intro") return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg,#030712 0%,#0c1445 50%,#030712 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Exo 2', sans-serif", position: "relative", overflow: "hidden",
    }}>
      <Stars />
      {/* Glow orbs */}
      <div style={{ position: "fixed", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(56,189,248,0.08),transparent 70%)", top: "10%", left: "5%", pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(129,140,248,0.1),transparent 70%)", bottom: "15%", right: "10%", pointerEvents: "none" }} />
      <div style={{
        position: "relative", zIndex: 1, textAlign: "center", padding: "40px",
        maxWidth: 640, animation: "fadeSlideIn 0.8s ease forwards",
      }}>
        {/* Plane icon */}
        <div style={{ fontSize: 64, marginBottom: 16 }}>✈️</div>
        <div style={{
          fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: 6,
          color: "#38bdf8", textTransform: "uppercase", marginBottom: 16, fontWeight: 700,
        }}>EASA Certification</div>
        <h1 style={{
          fontFamily: "'Orbitron', sans-serif", fontSize: 42, fontWeight: 900,
          color: "#fff", lineHeight: 1.1, marginBottom: 12,
          textShadow: "0 0 40px rgba(56,189,248,0.5)",
        }}>Flight Dispatcher<br /><span style={{ color: "#38bdf8" }}>Quiz System</span></h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
          An AI-adaptive examination covering <strong style={{ color: "#38bdf8" }}>Navigation</strong>, <strong style={{ color: "#818cf8" }}>Meteorology</strong>, and <strong style={{ color: "#fbbf24" }}>Flight Dispatcher</strong> concepts. Difficulty adjusts based on your performance across 10 levels.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 36 }}>
          {[["10", "Questions"], ["10", "Levels"], ["AI", "Adaptive"]].map(([v, l]) => (
            <div key={l} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "16px 24px", minWidth: 90,
            }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 28, color: "#38bdf8", fontWeight: 700 }}>{v}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
        </div>
        <button onClick={startQuiz} style={{
          background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
          border: "none", borderRadius: 12, padding: "16px 48px",
          color: "#fff", fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 700,
          letterSpacing: 2, cursor: "pointer", animation: "pulse-glow 2s infinite",
          transition: "transform 0.2s",
        }}
          onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.target.style.transform = "scale(1)"}
        >BEGIN EXAMINATION</button>
      </div>
    </div>
  );

  if (screen === "result") {
    const pct = Math.round((score / 10) * 100);
    const grade = pct >= 90 ? "DISTINGUISHED" : pct >= 70 ? "PROFICIENT" : pct >= 50 ? "COMPETENT" : "NEEDS REVIEW";
    const gradeColor = pct >= 90 ? "#38bdf8" : pct >= 70 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
    const topicStats = ["Navigation", "Meteorology", "Flight Dispatcher"].map(t => {
      const qs = history.filter(h => h.topic === t);
      return { topic: t, correct: qs.filter(h => h.isCorrect).length, total: qs.length };
    });
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg,#030712,#0c1445,#030712)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Exo 2', sans-serif", padding: 24, position: "relative",
      }}>
        <Stars />
        <div style={{
          position: "relative", zIndex: 1, maxWidth: 680, width: "100%",
          animation: "fadeSlideIn 0.6s ease forwards",
        }}>
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 24, padding: "40px 36px", textAlign: "center",
          }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, letterSpacing: 5, color: "#38bdf8", marginBottom: 12 }}>EXAMINATION COMPLETE</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 64, fontWeight: 900,
              color: gradeColor, textShadow: `0 0 30px ${gradeColor}`,
              animation: "countUp 0.6s ease forwards", marginBottom: 4,
            }}>{pct}%</div>
            <div style={{ color: gradeColor, fontWeight: 700, letterSpacing: 3, fontSize: 13, marginBottom: 24 }}>{grade}</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
              {[
                ["Score", `${score}/10`],
                ["Final Level", `${finalLevel}/10`],
                ["Correct", `${score} Questions`],
              ].map(([l, v]) => (
                <div key={l} style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12, padding: "14px 20px",
                }}>
                  <div style={{ color: "#38bdf8", fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 700 }}>{v}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 1 }}>{l}</div>
                </div>
              ))}
            </div>
            {/* Topic breakdown */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Performance by Topic</div>
              {topicStats.map(({ topic, correct, total }) => total > 0 && (
                <div key={topic} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{topic}</span>
                    <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{correct}/{total}</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3 }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      background: "linear-gradient(90deg,#38bdf8,#6366f1)",
                      width: `${total ? (correct / total) * 100 : 0}%`,
                      transition: "width 0.8s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setScreen("intro"); }} style={{
              background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
              border: "none", borderRadius: 12, padding: "14px 40px",
              color: "#fff", fontFamily: "'Orbitron',sans-serif", fontSize: 13,
              fontWeight: 700, letterSpacing: 2, cursor: "pointer",
            }}>RETAKE EXAM</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz screen ──
  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg,#030712,#0c1445,#030712)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Exo 2', sans-serif", padding: "24px 16px", position: "relative",
    }}>
      <Stars count={30} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, color: "#38bdf8", letterSpacing: 3 }}>✈ FLIGHT DISPATCHER EXAM</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Q {questionNum + 1}/10</span>
            <span style={{
              background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)",
              borderRadius: 20, padding: "4px 12px", fontSize: 12,
              fontFamily: "'Orbitron',sans-serif", color: "#38bdf8",
            }}>LVL {level}</span>
          </div>
        </div>
        <ProgressBar level={questionNum} />

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: "32px 28px",
          animation: animIn ? "fadeSlideIn 0.5s ease forwards" : "none",
        }}>
          {loadingQ ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{
                width: 48, height: 48, border: "3px solid rgba(56,189,248,0.2)",
                borderTopColor: "#38bdf8", borderRadius: "50%",
                animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
              }} />
              <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Orbitron',sans-serif", fontSize: 11, letterSpacing: 2 }}>GENERATING QUESTION...</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ color: "#f87171", marginBottom: 16 }}>{error}</div>
              <button onClick={() => loadQuestion(level)} style={{
                background: "rgba(56,189,248,0.1)", border: "1px solid #38bdf8",
                borderRadius: 8, padding: "10px 24px", color: "#38bdf8", cursor: "pointer",
              }}>Retry</button>
            </div>
          ) : currentQ && (
            <>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
                <TopicBadge topic={currentQ.topic} />
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>Difficulty {level}/10</span>
              </div>
              <p style={{ color: "#fff", fontSize: 17, lineHeight: 1.7, marginBottom: 28, fontWeight: 500 }}>
                {currentQ.question}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {currentQ.options?.map((opt, i) => {
                  const letter = opt.charAt(0);
                  const isSelected = selected === opt;
                  const isCorrect = currentQ.correct === letter;
                  let bg = "rgba(255,255,255,0.04)";
                  let border = "rgba(255,255,255,0.1)";
                  let color = "rgba(255,255,255,0.8)";
                  if (selected) {
                    if (isCorrect) { bg = "rgba(52,211,153,0.12)"; border = "#34d399"; color = "#34d399"; }
                    else if (isSelected) { bg = "rgba(248,113,113,0.12)"; border = "#f87171"; color = "#f87171"; }
                  }
                  return (
                    <button key={i} onClick={() => submitAnswer(opt)}
                      disabled={!!selected || loadingFeedback}
                      style={{
                        background: bg, border: `1px solid ${border}`,
                        borderRadius: 12, padding: "14px 18px",
                        color, fontSize: 14, textAlign: "left",
                        cursor: selected ? "default" : "pointer",
                        transition: "all 0.25s", fontFamily: "'Exo 2', sans-serif",
                        display: "flex", alignItems: "center", gap: 12,
                      }}
                      onMouseEnter={e => !selected && (e.currentTarget.style.background = "rgba(56,189,248,0.08)")}
                      onMouseLeave={e => !selected && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    >
                      <span style={{
                        fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
                        minWidth: 24, color: selected ? color : "#38bdf8",
                      }}>{letter}</span>
                      {opt.slice(3)}
                    </button>
                  );
                })}
              </div>
              {loadingFeedback && (
                <div style={{ textAlign: "center", marginTop: 16, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                  <span style={{ display: "inline-block", animation: "spin 0.8s linear infinite", marginRight: 6 }}>⚙</span>
                  Evaluating answer...
                </div>
              )}
              {feedback && (
                <div style={{
                  marginTop: 20, padding: "16px 20px", borderRadius: 12,
                  background: feedback.correct ? "rgba(52,211,153,0.07)" : "rgba(248,113,113,0.07)",
                  border: `1px solid ${feedback.correct ? "#34d399" : "#f87171"}`,
                  animation: "fadeSlideIn 0.4s ease forwards",
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{feedback.correct ? "✅" : "❌"}</span>
                    <span style={{
                      fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
                      letterSpacing: 1, color: feedback.correct ? "#34d399" : "#f87171",
                    }}>{feedback.correct ? "CORRECT" : "INCORRECT"}</span>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.7 }}>{feedback.text}</p>
                  <button onClick={nextQuestion} style={{
                    marginTop: 14, background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
                    border: "none", borderRadius: 8, padding: "10px 28px",
                    color: "#fff", fontFamily: "'Orbitron',sans-serif", fontSize: 11,
                    fontWeight: 700, letterSpacing: 2, cursor: "pointer",
                  }}>
                    {questionNum + 1 >= 10 ? "VIEW RESULTS →" : "NEXT QUESTION →"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {/* Score bar */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, padding: "0 4px" }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Score: {score}/{questionNum + (feedback ? 1 : 0)}</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Level {level}/10</span>
        </div>
      </div>
    </div>
  );
}
