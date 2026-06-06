/* Shared sample report content for the TapeCoach report-view template explorations.
 * One coherent, realistic scenario so every template shows the same data and
 * can be compared fairly. Performer-facing, honest-but-supportive tone.
 * Scenario: screen-acting self-tape, brief supplied, Professional level,
 * overall readiness 78 — "review carefully / polish before sending".
 */
window.REPORT = {
  meta: {
    project: "Untitled Channel 4 Drama — Ep. 3",
    role: "DI Maya Okafor",
    discipline: "Screen acting",
    take: "Take 2",
    version: "Version 2 · active",
    judgedAgainst: "Professional",
    scoringBasis: "Brief supplied",
    runtime: "1:52",
    submitted: "4 Jun 2026",
  },

  // The headline answer.
  verdict: {
    decision: "review_carefully",          // submit | review_carefully | submit_if_close | retake
    label: "Review before you send",
    short: "Almost there",
    headline: "Strong, truthful work — tighten two things and this is ready.",
    explanation:
      "This reads as a confident, castable take and your choices land. It sits at 78 rather than higher because the room tone jumps when the second side starts, and your eyeline drifts off the reader through the back half. Both are quick fixes — neither is about your acting.",
    rationale: [
      { title: "Your performance is on-brief and specific", detail: "The restraint you bring to the interrogation is exactly the register the brief asks for." },
      { title: "Two technical issues hold it back", detail: "An audible audio shift between sides and a wandering eyeline are reading as 'unfinished', not 'unable'." },
      { title: "Both are 20-minute fixes", detail: "Re-record audio in one pass and re-anchor your reader — no need to rebuild the performance." },
    ],
  },

  score: {
    overall: 78,
    band: "Nearly submit-ready",
    scaleNote: "0–100 submission readiness, judged at Professional level.",
  },

  // Category scores (screen acting → no singing/vocal-music row).
  categories: [
    { key: "acting", label: "Acting & choices", score: 84, note: "Specific, truthful, well within the brief's register. Loses points only on a dropped beat in Side B." },
    { key: "brief_adherence", label: "Brief fit", score: 82, note: "Both sides delivered as written; slate was not included." },
    { key: "professional_presentation", label: "Presentation", score: 79, note: "Clean, professional setup. Headroom is slightly generous." },
    { key: "technical", label: "Framing & eyeline", score: 74, note: "Eyeline drifts off the reader from roughly the midpoint of Side B." },
    { key: "audio", label: "Audio", score: 70, note: "Clear and intelligible, but room tone changes audibly between the two sides." },
  ],

  // Single most-important action.
  fixFirst: {
    title: "Re-record both sides in one audio pass",
    action:
      "Your room tone changes when Side B begins — likely a mic move or a different take spliced in. Record both sides back-to-back at the same mic distance in one sitting so the sound is continuous. This is the one thing most likely to move a casting director from 'nearly' to 'yes'.",
    impact: "Lifts Audio and Presentation; removes the main 'unfinished' signal.",
    minutes: 20,
  },

  fixes: {
    priority: [
      { title: "Re-anchor your eyeline to the reader", detail: "From about 1:14 your focus drifts past the lens. Put the reader just beside the lens and keep returning to them." },
      { title: "Add the slate the brief asked for", detail: "Name, height and representation were requested and aren't on the tape. A 5-second slate at the top covers it." },
    ],
    improve: [
      { title: "Hold the pause before 'You already know'", detail: "You rush the beat at 0:58. Let it sit a half-second longer — the silence is doing the work." },
      { title: "Bring the reader's volume down", detail: "The off-camera reader is louder than you in places, which pulls focus. A touch quieter keeps you central." },
    ],
    polish: [
      { title: "Tighten headroom by ~10%", detail: "There's a little extra space above your head. Framing slightly closer reads more 'screen'." },
    ],
    preserve: [
      { title: "The stillness before your line at 0:48", detail: "Don't fill it — that quiet is the most truthful moment in the tape." },
      { title: "The unforced shift into anger on Side B", detail: "It arrives without push. Keep it exactly that size." },
    ],
    doNotOverfix: [
      { title: "Don't add more 'acting' to Side A", detail: "The restraint is the choice that's working. Resist the urge to do more." },
    ],
  },

  strengths: [
    { title: "Truthful, specific choices", detail: "Every line is motivated; nothing is general or 'indicated'." },
    { title: "The camera likes you", detail: "You're comfortable in close-up and your thought process reads clearly on your face." },
    { title: "On-brief register", detail: "The controlled, watchful quality matches DI Okafor as written." },
  ],

  // Brief: what was asked vs what was observed.
  brief: {
    summary: "Two sides plus a slate were requested. Both scenes were delivered and on-brief; the slate was not included.",
    overallStatus: "mostly_achieved",
    requirements: [
      { name: "Side A — interrogation scene", importance: "mandatory", category: "Material", status: "achieved", evidence: "Delivered in full, as written, 0:06–0:58." },
      { name: "Side B — corridor confrontation", importance: "mandatory", category: "Material", status: "achieved", evidence: "Delivered in full, 1:02–1:52." },
      { name: "Slate: name, height, representation", importance: "preferred", category: "Admin", status: "missing", evidence: "No slate observed anywhere in the tape." },
      { name: "Landscape, head-and-shoulders framing", importance: "mandatory", category: "Technical", status: "achieved", evidence: "Landscape; framing is head-and-shoulders throughout." },
      { name: "One continuous file", importance: "mandatory", category: "Admin", status: "achieved", evidence: "Single file; no visible cuts." },
      { name: "Neutral off-camera reader", importance: "preferred", category: "Performance", status: "partial", evidence: "Reader present and neutral, but louder than the performer in places." },
    ],
  },

  // Observed sequence in the tape.
  observed: [
    { time: "0:00–0:06", label: "Settle / first frame", note: "You enter frame already in it — good. No slate." },
    { time: "0:06–0:58", label: "Side A — interrogation", note: "Restrained, watchful. Strongest section." },
    { time: "0:58–1:02", label: "Reset between sides", note: "Clean reset; audio character changes here." },
    { time: "1:02–1:52", label: "Side B — corridor", note: "Builds well; eyeline drifts in the back half." },
  ],

  technique: {
    summary: "Technique notes are shown only where the tape clearly supports them.",
    sections: [
      {
        area: "Acting",
        status: "assessable",
        headline: "Confident, internalised work that trusts the close-up.",
        working: ["Thought is visible between lines", "Choices are specific and motivated"],
        improve: ["Protect your pauses — don't rush the silences", "Keep the build on Side B from tipping into volume"],
      },
      {
        area: "Self-tape presentation",
        status: "assessable",
        headline: "Professional setup; small adjustments only.",
        working: ["Even, flattering light", "Stable frame, no camera drift"],
        improve: ["Tighten headroom slightly", "Bring the reader off-camera and lower in the mix"],
      },
    ],
  },

  timeline: [
    { time: "0:06", kind: "strength", text: "Strong, quiet entry — you're already in the scene." },
    { time: "0:48", kind: "strength", text: "The stillness before the line. Preserve this." },
    { time: "0:58", kind: "improve", text: "Pause is rushed — let it breathe half a second longer." },
    { time: "1:00", kind: "issue", text: "Room tone shifts as Side B begins — audio is not continuous." },
    { time: "1:14", kind: "issue", text: "Eyeline starts drifting off the reader." },
    { time: "1:39", kind: "strength", text: "The shift into anger lands without push. Keep it." },
  ],

  nextAction: {
    plan: [
      "Set up both sides in one sitting at a fixed mic distance.",
      "Place your reader just beside the lens and keep returning to them.",
      "Record a 5-second slate: name, height, representation.",
      "Do two takes; keep the one where you protect the 0:48 stillness.",
    ],
    ifShort: "If the deadline is tonight, this version is submittable — but fix the audio first; it's the most visible issue.",
    checklist: ["Continuous audio across both sides", "Slate included", "Eyeline anchored to reader", "Headroom tightened"],
  },

  limitations: [
    "Audio levels are assessed by ear from the submitted file, not measured in dB.",
    "Eyeline is judged against an assumed off-camera reader position; the reader is heard but not seen.",
  ],
};
