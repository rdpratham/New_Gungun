export const DAILY_QUOTES = [
  "Every call you make is one step closer to your next big win.",
  "Success in sales starts with consistency, not luck.",
  "The more conversations you create, the more opportunities you unlock.",
  "Confidence, energy, and persistence close more deals than talent alone.",
  "Every \"no\" teaches you how to earn a stronger \"yes.\"",
  "Great salespeople don't wait for opportunities — they create them.",
  "Your attitude on calls decides your results before the pitch begins.",
  "Discipline in daily activity always beats temporary motivation.",
  "Every follow-up ignored by others is a chance for you to win.",
  "Strong pipelines are built through small actions repeated every day.",
  "Top performers focus on solutions, not excuses.",
  "The harder you work on your process, the easier closing becomes.",
  "Rejection is temporary, but giving up makes it permanent.",
  "The next deal can come from the next dial you make.",
  "Revenue grows when relationships are built with trust and consistency.",
  "Sales is not about pressure — it's about solving real problems.",
  "Big incentives are earned through small disciplined efforts daily.",
  "Momentum in sales starts with showing up and taking action.",
  "Every meeting booked today builds a stronger tomorrow.",
  "Winners in sales stay focused even when results take time.",
  "Objections are not roadblocks; they are opportunities to explain value.",
  "Your effort today decides the size of your paycheck tomorrow.",
  "Consistent follow-ups separate average performers from top closers.",
  "Every target achieved once can be achieved again at a bigger level.",
  "Great communication creates trust, and trust creates sales.",
  "The best salespeople know that persistence always pays off.",
  "One productive day can completely change your monthly numbers.",
  "The more value you provide, the easier selling becomes.",
  "Sales rewards people who stay hungry, focused, and disciplined.",
  "Every successful closer was once a beginner who refused to quit.",
];

export function getDailyQuote() {
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const [y, m, d] = now.split('-').map(Number);
  const startOfYear = new Date(y, 0, 0);
  const thisDay = new Date(y, m - 1, d);
  const dayOfYear = Math.round((thisDay - startOfYear) / (1000 * 60 * 60 * 24));
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}
