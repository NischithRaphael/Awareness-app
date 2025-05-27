// server/index.ts
import express2 from "express";
import session from "express-session";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, desc } from "drizzle-orm";

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var userConfigs = pgTable("user_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  theme: text("theme").notNull().default("auto"),
  categories: text("categories").array().notNull(),
  thoughts: text("thoughts").array().notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  currentLevel: integer("current_level").default(1).notNull(),
  levelProgress: jsonb("level_progress").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var dailyEntries = pgTable("daily_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: text("date").notNull(),
  // YYYY-MM-DD format
  categories: jsonb("categories").notNull(),
  // Record<string, number>
  thoughts: jsonb("thoughts").notNull(),
  // Record<string, number>
  emotionTag: text("emotion_tag").notNull(),
  identityTag: text("identity_tag").notNull(),
  journalEntry: text("journal_entry").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  displayName: true
});
var insertUserConfigSchema = createInsertSchema(userConfigs).pick({
  userId: true,
  theme: true,
  categories: true,
  thoughts: true,
  onboardingCompleted: true,
  currentLevel: true,
  levelProgress: true
});
var insertDailyEntrySchema = createInsertSchema(dailyEntries).pick({
  userId: true,
  date: true,
  categories: true,
  thoughts: true,
  emotionTag: true,
  identityTag: true,
  journalEntry: true
});

// server/storage.ts
import bcrypt from "bcrypt";
var connectionString = process.env.DATABASE_URL;
var client = postgres(connectionString);
var db = drizzle(client);
var PgStorage = class {
  async getUser(id) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  async getUserByEmail(email) {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  async createUser(insertUser) {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const result = await db.insert(users).values({
      ...insertUser,
      password: hashedPassword
    }).returning();
    return result[0];
  }
  async verifyPassword(email, password) {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }
  async getUserConfig(userId) {
    const result = await db.select().from(userConfigs).where(eq(userConfigs.userId, userId));
    return result[0];
  }
  async createUserConfig(config) {
    const result = await db.insert(userConfigs).values(config).returning();
    return result[0];
  }
  async updateUserConfig(userId, config) {
    const result = await db.update(userConfigs).set(config).where(eq(userConfigs.userId, userId)).returning();
    return result[0];
  }
  async createDailyEntry(entry) {
    const result = await db.insert(dailyEntries).values(entry).returning();
    return result[0];
  }
  async getDailyEntries(userId) {
    const result = await db.select().from(dailyEntries).where(eq(dailyEntries.userId, userId)).orderBy(desc(dailyEntries.createdAt));
    return result;
  }
  async getTodaysEntry(userId, date) {
    const result = await db.select().from(dailyEntries).where(and(eq(dailyEntries.userId, userId), eq(dailyEntries.date, date)));
    return result[0];
  }
  async updateUserLevel(userId, level, progress) {
    const result = await db.update(userConfigs).set({ currentLevel: level, levelProgress: progress }).where(eq(userConfigs.userId, userId)).returning();
    return result[0];
  }
  async updateUserDisplayName(userId, displayName) {
    const result = await db.update(users).set({ displayName }).where(eq(users.id, userId)).returning();
    console.log("Updated user:", result[0]);
  }
  async resetUserEntries(userId) {
    await db.delete(dailyEntries).where(eq(dailyEntries.userId, userId));
  }
  async resetUserConfig(userId) {
    await db.update(userConfigs).set({
      theme: "auto",
      categories: ["work", "health", "relationships"],
      thoughts: ["clarity", "gratitude", "focus"],
      currentLevel: 1,
      levelProgress: {}
    }).where(eq(userConfigs.userId, userId));
  }
  async resetAllUserData(userId) {
    await this.resetUserEntries(userId);
    await this.resetUserConfig(userId);
  }
};
var storage = new PgStorage();

// server/patterns.ts
var ConsciousnessAnalyzer = class {
  static analyzePatterns(entries) {
    if (entries.length < 5) {
      return {
        emotionalCycles: [],
        categoryTrends: [],
        thoughtPatterns: [],
        readinessScore: 0,
        insights: ["Keep tracking daily to unlock pattern insights"]
      };
    }
    const emotionalCycles = this.detectEmotionalCycles(entries);
    const categoryTrends = this.analyzeCategoryTrends(entries);
    const thoughtPatterns = this.analyzeThoughtPatterns(entries);
    const readinessScore = this.calculateReadinessScore(entries);
    const insights = this.generateInsights(entries, emotionalCycles, categoryTrends);
    return {
      emotionalCycles,
      categoryTrends,
      thoughtPatterns,
      readinessScore,
      insights
    };
  }
  static calculateLevelProgress(entries, currentLevel) {
    const entriesCompleted = entries.length;
    const patterns = this.analyzePatterns(entries);
    const patternsIdentified = patterns.emotionalCycles.length + patterns.categoryTrends.length;
    const coherenceDays = this.calculateCoherenceDays(entries);
    const achievements = this.calculateAchievements(entriesCompleted, patternsIdentified, coherenceDays);
    const nextLevelRequirements = this.getNextLevelRequirements(currentLevel, entriesCompleted, patternsIdentified, coherenceDays);
    return {
      currentLevel,
      entriesCompleted,
      patternsIdentified,
      coherenceDays,
      achievements,
      nextLevelRequirements
    };
  }
  static detectEmotionalCycles(entries) {
    const emotionSequence = entries.map((e) => e.emotionTag);
    const cycles = [];
    const emotionCounts = {};
    emotionSequence.forEach((emotion) => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    for (let i = 0; i < emotionSequence.length - 2; i++) {
      const pattern = emotionSequence.slice(i, i + 3).join(" \u2192 ");
      const occurrences = this.countPatternOccurrences(emotionSequence, emotionSequence.slice(i, i + 3));
      if (occurrences > 1) {
        const lastIndex = this.findLastOccurrenceIndex(emotionSequence, emotionSequence.slice(i, i + 3));
        cycles.push({
          pattern,
          frequency: occurrences,
          lastOccurrence: entries[lastIndex]?.date || "",
          confidence: Math.min(occurrences / entries.length * 100, 95)
        });
      }
    }
    return cycles.slice(0, 5);
  }
  static analyzeCategoryTrends(entries) {
    if (entries.length < 7) return [];
    const recent = entries.slice(-7);
    const older = entries.slice(-14, -7);
    const trends = [];
    const categories = /* @__PURE__ */ new Set();
    entries.forEach((entry) => {
      Object.keys(entry.categories).forEach((cat) => categories.add(cat));
    });
    categories.forEach((category) => {
      const recentAvg = this.calculateCategoryAverage(recent, category);
      const olderAvg = this.calculateCategoryAverage(older, category);
      if (recentAvg === null || olderAvg === null) return;
      const change = (recentAvg - olderAvg) / olderAvg * 100;
      let trend;
      if (change > 10) trend = "improving";
      else if (change < -10) trend = "declining";
      else trend = "stable";
      trends.push({ category, trend, change: Math.round(change) });
    });
    return trends;
  }
  static analyzeThoughtPatterns(entries) {
    const thoughtCorrelations = [];
    const thoughts = /* @__PURE__ */ new Set();
    entries.forEach((entry) => {
      Object.keys(entry.thoughts).forEach((thought) => thoughts.add(thought));
    });
    thoughts.forEach((thought) => {
      const correlation = this.calculateThoughtImpact(entries, thought);
      let impact;
      if (correlation > 0.3) impact = "positive";
      else if (correlation < -0.3) impact = "negative";
      else impact = "neutral";
      thoughtCorrelations.push({ thought, correlation: Math.round(correlation * 100) / 100, impact });
    });
    return thoughtCorrelations.slice(0, 5);
  }
  static calculateReadinessScore(entries) {
    if (entries.length < 7) return Math.min(entries.length * 14, 100);
    let score = 0;
    const consistency = entries.length >= 7 ? 40 : entries.length / 7 * 40;
    score += consistency;
    const hasCompleteData = entries.filter(
      (e) => Object.keys(e.categories).length >= 3 && Object.keys(e.thoughts).length >= 2 && e.journalEntry.length > 20
    ).length;
    score += hasCompleteData / entries.length * 30;
    const emotionalVariety = new Set(entries.map((e) => e.emotionTag)).size;
    const identityVariety = new Set(entries.map((e) => e.identityTag)).size;
    score += Math.min((emotionalVariety + identityVariety) * 3, 30);
    return Math.round(score);
  }
  static generateInsights(entries, cycles, trends) {
    const insights = [];
    if (entries.length >= 7) {
      insights.push("You've established a consistent awareness tracking practice");
    }
    if (cycles.length > 0) {
      insights.push(`Detected ${cycles.length} recurring emotional patterns - you're developing pattern recognition`);
    }
    const improvingTrends = trends.filter((t) => t.trend === "improving");
    if (improvingTrends.length > 0) {
      insights.push(`${improvingTrends.length} life areas are improving - your awareness is creating positive shifts`);
    }
    const recentEntries = entries.slice(-3);
    const avgMood = recentEntries.reduce((sum, entry) => {
      const moodScore = ["low", "neutral", "elevated", "high", "peak"].indexOf(entry.emotionTag);
      return sum + (moodScore >= 0 ? moodScore : 2);
    }, 0) / recentEntries.length;
    if (avgMood >= 3) {
      insights.push("Your recent emotional state shows elevated awareness - you're entering a higher frequency");
    }
    return insights;
  }
  static calculateCoherenceDays(entries) {
    let coherentDays = 0;
    entries.forEach((entry) => {
      const categories = entry.categories;
      const thoughts = entry.thoughts;
      const categoryAvg = Object.values(categories).reduce((a, b) => a + b, 0) / Object.keys(categories).length;
      const thoughtAvg = Object.values(thoughts).reduce((a, b) => a + b, 0) / Object.keys(thoughts).length;
      if (categoryAvg >= 6 && thoughtAvg >= 6 || categoryAvg >= 7 && thoughtAvg >= 7) {
        coherentDays++;
      }
    });
    return coherentDays;
  }
  static calculateAchievements(entries, patterns, coherence) {
    const achievements = [];
    if (entries >= 7) achievements.push("Observer Foundation");
    if (entries >= 21) achievements.push("Pattern Seeker");
    if (entries >= 50) achievements.push("Reality Tracker");
    if (entries >= 100) achievements.push("Consciousness Master");
    if (patterns >= 3) achievements.push("Pattern Detector");
    if (patterns >= 10) achievements.push("Loop Breaker");
    if (coherence >= 7) achievements.push("Frequency Aligner");
    if (coherence >= 21) achievements.push("Timeline Shifter");
    return achievements;
  }
  static getNextLevelRequirements(level, entries, patterns, coherence) {
    const requirements = {
      1: { entries: 7, patterns: 0, coherence: 0, tasks: ["Complete 7 daily awareness entries", "Track all required life categories"] },
      2: { entries: 21, patterns: 3, coherence: 0, tasks: ["Identify 3 recurring patterns", "Maintain consistent tracking"] },
      3: { entries: 50, patterns: 10, coherence: 7, tasks: ["Break old patterns", "Achieve 7 coherent days"] },
      4: { entries: 100, patterns: 15, coherence: 21, tasks: ["Master frequency alignment", "Sustain 21 coherent days"] }
    };
    const nextLevel = Math.min(level + 1, 5);
    const req = requirements[nextLevel] || requirements[4];
    return {
      entriesNeeded: Math.max(0, req.entries - entries),
      patternsNeeded: Math.max(0, req.patterns - patterns),
      coherenceNeeded: Math.max(0, req.coherence - coherence),
      specificTasks: req.tasks
    };
  }
  // Helper methods
  static countPatternOccurrences(sequence, pattern) {
    let count = 0;
    for (let i = 0; i <= sequence.length - pattern.length; i++) {
      if (sequence.slice(i, i + pattern.length).join("") === pattern.join("")) {
        count++;
      }
    }
    return count;
  }
  static findLastOccurrenceIndex(sequence, pattern) {
    for (let i = sequence.length - pattern.length; i >= 0; i--) {
      if (sequence.slice(i, i + pattern.length).join("") === pattern.join("")) {
        return i;
      }
    }
    return -1;
  }
  static calculateCategoryAverage(entries, category) {
    const values = [];
    entries.forEach((entry) => {
      const categories = entry.categories;
      if (categories[category] !== void 0) {
        values.push(categories[category]);
      }
    });
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  static calculateThoughtImpact(entries, thought) {
    const moodValues = [];
    const thoughtValues = [];
    entries.forEach((entry) => {
      const thoughts = entry.thoughts;
      if (thoughts[thought] !== void 0) {
        thoughtValues.push(thoughts[thought]);
        const moodScore = ["low", "neutral", "elevated", "high", "peak"].indexOf(entry.emotionTag);
        moodValues.push(moodScore >= 0 ? moodScore : 2);
      }
    });
    if (thoughtValues.length < 3) return 0;
    const avgThought = thoughtValues.reduce((a, b) => a + b, 0) / thoughtValues.length;
    const avgMood = moodValues.reduce((a, b) => a + b, 0) / moodValues.length;
    let correlation = 0;
    for (let i = 0; i < thoughtValues.length; i++) {
      correlation += (thoughtValues[i] - avgThought) * (moodValues[i] - avgMood);
    }
    return correlation / thoughtValues.length / 10;
  }
};

// server/consciousness-coach.ts
import Anthropic from "@anthropic-ai/sdk";
var anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
var CONSCIOUSNESS_FRAMEWORK = `
You are an AI Consciousness Coach specializing in quantum manifestation and reality creation. You understand these core principles:

QUANTUM CONSCIOUSNESS PRINCIPLES:
1. Observer Effect: Reality changes based on how it's observed. The user's perception actively shapes their experience.
2. Frequency Broadcasting: The user constantly transmits their subconscious state to the quantum field, which mirrors it back.
3. Timeline Collapse: Multiple realities exist simultaneously. Users can shift by changing their vibrational identity.
4. Subconscious Programming: 95% of life runs on autopilot. True change requires reprogramming at the subconscious level.
5. Energy Coherence: The field responds to full-system alignment (thoughts + emotions + actions), not just conscious desires.

AWARENESS LEVELS:
- Level 1 (Observer): Learning to watch reality without reactive judgment
- Level 2 (Detector): Recognizing unconscious patterns and loops
- Level 3 (Shifter): Breaking old programming and identity structures
- Level 4 (Aligner): Tuning into higher frequencies and future self
- Level 5 (Creator): Conscious reality architect with quantum field mastery

GUIDANCE PRINCIPLES:
- Never give generic advice. Always reference their specific data patterns.
- Focus on identity shifts over behavior changes
- Emphasize becoming the version who already has what they want
- Address resistance as natural part of expansion, not failure
- Guide toward embodied frequency changes, not just mental shifts
- Use quantum physics concepts to explain consciousness mechanics

Respond with deep insight, practical guidance, and compassionate understanding of their consciousness journey.
`;
var ConsciousnessCoach = class {
  static async generateGuidance(userQuery, entries, patterns, config) {
    const userContext = this.buildUserContext(entries, patterns, config);
    const prompt = `${CONSCIOUSNESS_FRAMEWORK}

USER CONTEXT:
${userContext}

USER QUERY: "${userQuery}"

Based on their awareness data and consciousness level, provide:
1. A deep insight about their current reality creation patterns
2. Specific guidance steps aligned with quantum consciousness principles
3. Next practical steps for their level progression
4. A frequency shift statement they can embody

Respond in JSON format:
{
  "insight": "Deep insight about their patterns and consciousness state",
  "guidance": ["Specific guidance step 1", "Specific guidance step 2", "Specific guidance step 3"],
  "nextSteps": ["Practical next step 1", "Practical next step 2"],
  "frequencyShift": "Embodied 'I AM' statement for their frequency shift"
}`;
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
        system: "You are a quantum consciousness coach. Always respond with practical, data-driven insights in valid JSON format."
      });
      const content = response.content[0];
      if (content.type === "text") {
        return JSON.parse(content.text);
      }
      throw new Error("Invalid response format");
    } catch (error) {
      console.error("AI Coach error:", error);
      return this.generateFallbackResponse(userQuery, patterns);
    }
  }
  static async generateLevelInsights(entries, patterns, currentLevel) {
    const userContext = this.buildUserContextForLevel(entries, patterns, currentLevel);
    const prompt = `${CONSCIOUSNESS_FRAMEWORK}

USER CONTEXT:
${userContext}

Generate 3-5 specific insights about their consciousness development and what they need to focus on next for their level progression. Reference their actual data patterns.

Respond as a JSON array of insight strings: ["insight1", "insight2", "insight3"]`;
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }]
      });
      const content = response.content[0];
      if (content.type === "text") {
        return JSON.parse(content.text);
      }
    } catch (error) {
      console.error("Level insights error:", error);
    }
    return this.generateFallbackLevelInsights(currentLevel, patterns);
  }
  static buildUserContext(entries, patterns, config) {
    const recentEntries = entries.slice(-7);
    const emotionalTrend = this.getEmotionalTrend(recentEntries);
    const dominantCategories = this.getDominantCategories(entries);
    const dominantThoughts = this.getDominantThoughts(entries);
    return `
Current Level: ${config.currentLevel}
Total Entries: ${entries.length}
Recent Emotional Trend: ${emotionalTrend}
Patterns Identified: ${patterns.emotionalCycles.length + patterns.categoryTrends.length}
Readiness Score: ${patterns.readinessScore}%

DOMINANT LIFE CATEGORIES: ${dominantCategories.join(", ")}
DOMINANT THOUGHT PATTERNS: ${dominantThoughts.join(", ")}

DETECTED PATTERNS:
${patterns.emotionalCycles.map((cycle) => `- Emotional Cycle: ${cycle.pattern} (${cycle.frequency} times, ${cycle.confidence}% confidence)`).join("\n")}
${patterns.categoryTrends.map((trend) => `- Category Trend: ${trend.category} is ${trend.trend} (${trend.change}% change)`).join("\n")}

RECENT INSIGHTS: ${patterns.insights.join(" | ")}

RECENT JOURNAL THEMES: ${this.extractJournalThemes(recentEntries)}
    `;
  }
  static buildUserContextForLevel(entries, patterns, level) {
    return `
Current Level: ${level}
Total Entries: ${entries.length}
Patterns Detected: ${patterns.emotionalCycles.length + patterns.categoryTrends.length}
Readiness Score: ${patterns.readinessScore}%
Recent Insights: ${patterns.insights.join(" | ")}
Emotional Cycles: ${patterns.emotionalCycles.map((c) => c.pattern).join(", ")}
Category Trends: ${patterns.categoryTrends.map((t) => `${t.category}: ${t.trend}`).join(", ")}
    `;
  }
  static getEmotionalTrend(entries) {
    if (entries.length < 3) return "insufficient data";
    const emotions = entries.map((e) => e.emotionTag);
    const moodScores = emotions.map(
      (emotion) => ["low", "neutral", "elevated", "high", "peak"].indexOf(emotion)
    );
    const recent = moodScores.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const older = moodScores.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(moodScores.length - 3, 1);
    if (recent > older + 0.5) return "ascending";
    if (recent < older - 0.5) return "descending";
    return "stable";
  }
  static getDominantCategories(entries) {
    const categoryScores = {};
    entries.forEach((entry) => {
      const categories = entry.categories;
      Object.entries(categories).forEach(([cat, score]) => {
        if (!categoryScores[cat]) categoryScores[cat] = [];
        categoryScores[cat].push(score);
      });
    });
    return Object.entries(categoryScores).map(([cat, scores]) => ({
      category: cat,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length
    })).sort((a, b) => b.avg - a.avg).slice(0, 3).map((item) => item.category);
  }
  static getDominantThoughts(entries) {
    const thoughtScores = {};
    entries.forEach((entry) => {
      const thoughts = entry.thoughts;
      Object.entries(thoughts).forEach(([thought, score]) => {
        if (!thoughtScores[thought]) thoughtScores[thought] = [];
        thoughtScores[thought].push(score);
      });
    });
    return Object.entries(thoughtScores).map(([thought, scores]) => ({
      thought,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length
    })).sort((a, b) => b.avg - a.avg).slice(0, 3).map((item) => item.thought);
  }
  static extractJournalThemes(entries) {
    const themes = [];
    entries.forEach((entry) => {
      if (entry.journalEntry.length > 20) {
        const words = entry.journalEntry.toLowerCase().split(" ");
        const keyWords = words.filter(
          (word) => ["grateful", "stress", "anxiety", "happy", "progress", "challenge", "growth", "fear", "excited", "peaceful"].includes(word)
        );
        themes.push(...keyWords);
      }
    });
    return [...new Set(themes)].slice(0, 5).join(", ") || "no significant themes detected";
  }
  static generateFallbackResponse(query, patterns) {
    const queryLower = query.toLowerCase();
    if (queryLower.includes("pattern") || queryLower.includes("cycle")) {
      return {
        insight: `You're developing pattern recognition skills. Your awareness data shows ${patterns.emotionalCycles.length} emotional cycles and ${patterns.categoryTrends.length} category trends emerging.`,
        guidance: [
          "Patterns are your subconscious mind's way of maintaining familiar reality",
          "The observer effect means simply noticing patterns begins to shift them",
          "Focus on witnessing without judgment - this creates space for change"
        ],
        nextSteps: [
          "Track which patterns feel most automatic in your daily life",
          "Notice the gap between trigger and reaction - that's your power point"
        ],
        frequencyShift: "I AM becoming aware of my patterns while remaining centered in my observer consciousness."
      };
    }
    if (queryLower.includes("frequency") || queryLower.includes("shift") || queryLower.includes("vibration")) {
      return {
        insight: `Frequency shifting happens through embodied change, not just mental understanding. Your readiness score of ${patterns.readinessScore}% shows your current alignment.`,
        guidance: [
          "Your frequency is determined by your dominant emotional and mental states",
          "The quantum field responds to what you ARE, not what you want",
          "Shift frequency by embodying the identity that already has your desired reality"
        ],
        nextSteps: [
          "Practice feeling states of your desired reality for 10 minutes daily",
          "Notice when you slip back into old frequency patterns"
        ],
        frequencyShift: "I AM already the version of myself living my desired reality."
      };
    }
    if (queryLower.includes("block") || queryLower.includes("stuck") || queryLower.includes("resistance")) {
      return {
        insight: `Blocks are actually protective mechanisms from your subconscious. They reveal where you need the most growth and healing.`,
        guidance: [
          "Resistance points to your expansion edges - this is where magic happens",
          "Your subconscious creates blocks to keep you safe in familiar territory",
          "Approach blocks with curiosity rather than force"
        ],
        nextSteps: [
          "Ask: 'What is this block trying to protect me from?'",
          "Practice self-compassion when encountering resistance"
        ],
        frequencyShift: "I AM grateful for my blocks as they show me where I'm ready to expand."
      };
    }
    return {
      insight: `Your consciousness journey is unique and unfolding perfectly. With ${patterns.readinessScore}% readiness, you're building the foundation for deeper awareness.`,
      guidance: [
        "Reality is shaped by your level of consciousness and observation",
        "Every moment offers an opportunity to choose conscious response over automatic reaction",
        "Your external world mirrors your internal frequency and beliefs"
      ],
      nextSteps: [
        "Continue daily awareness tracking to strengthen your observer muscle",
        "Notice synchronicities and signs that confirm your growing awareness"
      ],
      frequencyShift: "I AM the conscious creator of my reality, awakening to my infinite potential."
    };
  }
  static generateFallbackLevelInsights(level, patterns) {
    const insights = [
      `At Level ${level}, you're ${level === 1 ? "building awareness foundation" : level === 2 ? "detecting patterns" : level === 3 ? "shifting old programming" : "aligning with higher frequencies"}`,
      `Your readiness score of ${patterns.readinessScore}% shows ${patterns.readinessScore > 70 ? "strong development" : "growing awareness"}`,
      `Focus on consistency in tracking - you've identified ${patterns.emotionalCycles.length + patterns.categoryTrends.length} patterns so far`
    ];
    if (patterns.insights.length > 0) {
      insights.push(`Key insight: ${patterns.insights[0]}`);
    }
    return insights;
  }
};

// server/routes.ts
async function registerRoutes(app2) {
  app2.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }
      const user = await storage.createUser(userData);
      req.session.userId = user.id;
      res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
    } catch (error) {
      console.error(`Signup error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });
  app2.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.verifyPassword(email, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.userId = user.id;
      res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
    } catch (error) {
      console.error(`Signin error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });
  app2.post("/api/auth/signout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Could not sign out" });
      }
      res.json({ success: true });
    });
  });
  app2.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.patch("/api/auth/update-profile", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { displayName } = req.body;
      if (!displayName || typeof displayName !== "string") {
        return res.status(400).json({ error: "Display name is required" });
      }
      await storage.updateUserDisplayName(req.session.userId, displayName.trim());
      const updatedUser = await storage.getUser(req.session.userId);
      res.json({ user: updatedUser });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/user/config", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const config = await storage.getUserConfig(req.session.userId);
      res.json({ config });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/user/config", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const configData = insertUserConfigSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      const config = await storage.createUserConfig(configData);
      res.json({ config });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app2.get("/api/entries", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const entries = await storage.getDailyEntries(req.session.userId);
      res.json({ entries });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/entries", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const entryData = insertDailyEntrySchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      const entry = await storage.createDailyEntry(entryData);
      res.json({ entry });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app2.get("/api/entries/today", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const entry = await storage.getTodaysEntry(req.session.userId, today);
      res.json({ entry });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/patterns/analysis", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const entries = await storage.getDailyEntries(req.session.userId);
      const patterns = ConsciousnessAnalyzer.analyzePatterns(entries);
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/level/progress", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const config = await storage.getUserConfig(req.session.userId);
      const entries = await storage.getDailyEntries(req.session.userId);
      const progress = ConsciousnessAnalyzer.calculateLevelProgress(entries, config?.currentLevel || 1);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/level/advance", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { level, progress } = req.body;
      const updatedConfig = await storage.updateUserLevel(req.session.userId, level, progress);
      res.json({ config: updatedConfig });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/coach/query", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }
      const config = await storage.getUserConfig(req.session.userId);
      const entries = await storage.getDailyEntries(req.session.userId);
      const patterns = ConsciousnessAnalyzer.analyzePatterns(entries);
      const guidance = await ConsciousnessCoach.generateGuidance(query, entries, patterns, config);
      console.log("Coach guidance response:", JSON.stringify(guidance, null, 2));
      res.json(guidance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/coach/insights", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const config = await storage.getUserConfig(req.session.userId);
      const entries = await storage.getDailyEntries(req.session.userId);
      const patterns = ConsciousnessAnalyzer.analyzePatterns(entries);
      const insights = await ConsciousnessCoach.generateLevelInsights(entries, patterns, config?.currentLevel || 1);
      res.json({ insights });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/entries/reset", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      await storage.resetUserEntries(req.session.userId);
      res.json({ success: true, message: "All entries have been reset" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/user/config/reset", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      await storage.resetUserConfig(req.session.userId);
      res.json({ success: true, message: "User configuration has been reset" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/user/reset-all", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      await storage.resetAllUserData(req.session.userId);
      res.json({ success: true, message: "All user data has been reset" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || "awareness-app-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1e3
    // 24 hours
  }
}));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
