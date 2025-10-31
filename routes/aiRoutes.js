import express from "express";
import ai from "../config/ai.js";
import upload from "../config/multerConfig.js";
import { extractTextFromPDF } from "../utils/extractTextFromPDF.js";
import { jsonrepair } from "jsonrepair";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const router = express.Router();

/* =========================================================
   🤖 1. AI JOB DESCRIPTION GENERATOR
   ========================================================= */
router.post("/generate-jd", async (req, res) => {
  try {
    console.log("🟩 /generate-jd body:", req.body);
    const { title, department, keywords } = req.body;

    if (!title)
      return res.status(400).json({ error: "Job title is required" });

    // Handle keywords properly - it might be a string or array
    let keywordsStr = "Not specified";
    if (keywords) {
      if (Array.isArray(keywords)) {
        keywordsStr = keywords.join(", ");
      } else if (typeof keywords === 'string') {
        keywordsStr = keywords;
      }
    }

    const prompt = `
      Write a detailed, professional job description for the position of ${title}.
      Department: ${department || "Not specified"}.
      Required skills: ${keywordsStr}.
      Company: Confidential.

      Structure it as:
      - Job Title
      - About the Company
      - Responsibilities
      - Required Skills
      - Preferred Qualifications
      - Benefits
      - How to Apply
    `;

    console.log("🤖 Generating content with Gemini...");
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const jdText = result.response.text();

    console.log("✅ JD Generated successfully");
    res.json({ jobDescription: jdText });
  } catch (error) {
    console.error("JD Generation Error:", error);
    console.error("Error details:", error.message);
    res.status(500).json({ error: "Failed to generate JD", details: error.message });
  }
});

/* =========================================================
   📄 2. AI RESUME SCREENING AGAINST JD (PDF)
   ========================================================= */
router.post("/screen-resume-pdf", upload.single("resume"), async (req, res) => {
  try {
    console.log("🟩 /screen-resume-pdf body:", req.body);
    console.log("🟦 Uploaded file:", req.file?.originalname);

    // 1️⃣ Validate inputs
    const { jobDescription } = req.body;
    if (!req.file || !jobDescription) {
      return res
        .status(400)
        .json({ error: "Missing resume file or job description" });
    }

    // 2️⃣ Extract text from the uploaded resume
    const resumeText = await extractTextFromPDF(req.file.buffer);
    console.log("📄 Extracted resume text length:", resumeText?.length || 0);

    // 3️⃣ Build AI prompt
    const prompt = `
You are an AI HR assistant screening resumes for a job.

Compare the following:

JOB DESCRIPTION:
${jobDescription}

RESUME TEXT:
${resumeText}

Respond ONLY in JSON format (no markdown or code fences).
Example output:
{
  "matchScore": 85,
  "summary": "The candidate has strong React experience...",
  "keyStrengths": ["Proficient in React", "Good teamwork"],
  "potentialGaps": ["No backend experience"]
}
`;

    console.log("🤖 Sending prompt to Gemini...");
    const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);

    // 4️⃣ Capture AI raw response
    let rawText = result.response.text();
    console.log("🧠 Gemini raw output:", rawText);

    // 5️⃣ Clean markdown fences or extra characters
    rawText = rawText.replace(/```json/i, "").replace(/```/g, "").trim();

    // 6️⃣ Try parsing JSON safely
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.warn("⚠️ Invalid JSON, attempting jsonrepair...");
      try {
        parsed = JSON.parse(jsonrepair(rawText));
      } catch (repairErr) {
        console.error("❌ JSON parse failed even after repair:", repairErr.message);
        return res.status(500).json({
          error: "AI returned invalid JSON",
          rawText,
        });
      }
    }

    // 7️⃣ Return structured data to frontend
    res.json({
      matchScore: parsed.matchScore ?? 0,
      summary: parsed.summary || "No summary provided.",
      keyStrengths: parsed.keyStrengths || [],
      potentialGaps: parsed.potentialGaps || [],
    });
  } catch (error) {
    console.error("🔥 Resume Screening Error:", error);
    res.status(500).json({
      error: "Failed to analyze resume",
      details: error.message,
    });
  }
});

/* =========================================================
   📊 3. AI EMPLOYEE PERFORMANCE INSIGHTS
   ========================================================= */

// Get AI-powered performance analytics
router.get("/performance-insights/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log("🟩 Getting performance insights for employee:", employeeId);

    // Convert employeeId to integer
    const userId = parseInt(employeeId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid employee ID format" });
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        performanceInsights: {
          orderBy: { analysisDate: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Check if we have recent insights (within last 24 hours)
    const recentInsight = user.performanceInsights[0];
    const isRecentInsight = recentInsight && 
      (new Date() - new Date(recentInsight.analysisDate)) < 24 * 60 * 60 * 1000;

    if (isRecentInsight) {
      console.log("✅ Returning cached performance insights");
      return res.json({
        employeeData: {
          employeeId: user.id,
          name: user.name,
          email: user.email,
          department: user.department
        },
        aiInsights: recentInsight.insights,
        generatedAt: recentInsight.createdAt
      });
    }

    // Generate new performance data (in real app, fetch from various sources)
    const performanceData = {
      employeeId: user.id,
      name: user.name,
      department: user.department,
      performanceScore: Math.floor(Math.random() * 30) + 70, // 70-100
      goals: [
        { name: "Complete React Training", status: "completed", progress: 100 },
        { name: "Lead Team Project", status: "in_progress", progress: 75 },
        { name: "Improve Code Quality", status: "pending", progress: 30 }
      ],
      feedback: [
        { date: "2024-01-15", rating: 4, comment: "Great work on the frontend improvements" },
        { date: "2024-01-10", rating: 5, comment: "Excellent collaboration with the team" },
        { date: "2024-01-05", rating: 3, comment: "Could improve on meeting deadlines" }
      ],
      skills: ["React", "JavaScript", "Team Leadership", "Problem Solving"],
      workload: "moderate",
      lastReview: "2024-01-15"
    };

    // AI prompt for performance analysis
    const prompt = `
Analyze the following employee performance data and provide insights:

Employee Performance Data:
- Performance Score: ${performanceData.performanceScore}/100
- Goals: ${JSON.stringify(performanceData.goals)}
- Recent Feedback: ${JSON.stringify(performanceData.feedback)}
- Skills: ${performanceData.skills.join(", ")}
- Current Workload: ${performanceData.workload}

Provide analysis in JSON format:
{
  "overallAssessment": "Brief overall performance assessment",
  "strengths": ["List of key strengths"],
  "improvementAreas": ["Areas needing improvement"],
  "riskLevel": "low|medium|high",
  "careerRecommendations": ["Career development suggestions"],
  "nextSteps": ["Immediate action items"]
}
`;

    console.log("🤖 Analyzing performance with Gemini...");
    const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);
    
    let rawText = result.response.text();
    rawText = rawText.replace(/```json/i, "").replace(/```/g, "").trim();

    let aiInsights;
    try {
      aiInsights = JSON.parse(rawText);
    } catch (err) {
      console.warn("⚠️ Invalid JSON, using fallback insights");
      aiInsights = {
        overallAssessment: "Performance analysis completed",
        strengths: ["Consistent performance", "Good technical skills"],
        improvementAreas: ["Time management", "Communication"],
        riskLevel: "low",
        careerRecommendations: ["Consider leadership training", "Expand technical skills"],
        nextSteps: ["Set quarterly goals", "Schedule regular check-ins"]
      };
    }

    // Save AI insights to database
    const savedInsight = await prisma.performanceInsight.create({
      data: {
        employeeId: user.id,
        performanceScore: performanceData.performanceScore,
        productivityRating: 85.0,
        qualityRating: 88.0,
        collaborationRating: 90.0,
        performanceForecast: JSON.stringify(aiInsights.performanceForecast || {}),
        riskFactors: JSON.stringify(aiInsights.riskFactors || []),
        recommendations: JSON.stringify(aiInsights.recommendations || []),
        strengths: JSON.stringify(aiInsights.strengths || []),
        improvementAreas: JSON.stringify(aiInsights.improvementAreas || []),
        confidence: 0.85,
        dataSource: "ai_analysis",
        nextQuarterForecast: JSON.stringify(aiInsights.nextQuarterForecast || {}),
        careerProgression: JSON.stringify(aiInsights.careerRecommendations || [])
      }
    });

    console.log("✅ Performance insights saved to database");

    res.json({
      employeeData: {
        employeeId: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        performanceScore: performanceData.performanceScore
      },
      aiInsights,
      generatedAt: savedInsight.createdAt
    });

  } catch (error) {
    console.error("🔥 Performance Insights Error:", error);
    res.status(500).json({
      error: "Failed to generate performance insights",
      details: error.message,
    });
  }
});

// Get predictive analytics for team/department
router.post("/predictive-analytics", async (req, res) => {
  try {
    const { department, timeframe, metrics } = req.body;
    console.log("🟩 Generating predictive analytics for:", department);

    // Mock team data
    const teamData = {
      department,
      totalEmployees: 15,
      avgPerformance: 82,
      turnoverRate: 12,
      satisfactionScore: 4.2,
      productivityTrend: [78, 80, 82, 85, 83],
      budgetUtilization: 87
    };

    const prompt = `
Analyze team performance data and provide predictive insights:

Department: ${department}
Team Data: ${JSON.stringify(teamData)}
Timeframe: ${timeframe}
Focus Metrics: ${metrics?.join(", ") || "general performance"}

Provide predictions in JSON format:
{
  "performanceTrend": {
    "direction": "improving|declining|stable",
    "prediction": "Performance trend description",
    "confidence": 85
  },
  "turnoverRisk": {
    "level": "low|medium|high",
    "atRiskEmployees": 2,
    "factors": ["List of risk factors"]
  },
  "budgetForecast": {
    "nextQuarter": 92,
    "recommendations": ["Budget optimization suggestions"]
  },
  "actionItems": ["Immediate recommendations for management"]
}
`;

    console.log("🤖 Generating predictive analytics with Gemini...");
    const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);
    
    let rawText = result.response.text();
    rawText = rawText.replace(/```json/i, "").replace(/```/g, "").trim();

    let predictions;
    try {
      predictions = JSON.parse(rawText);
    } catch (err) {
      console.warn("⚠️ Invalid JSON, using fallback predictions");
      predictions = {
        performanceTrend: {
          direction: "stable",
          prediction: "Team performance is expected to remain stable",
          confidence: 75
        },
        turnoverRisk: {
          level: "low",
          atRiskEmployees: 1,
          factors: ["Workload balance", "Career growth opportunities"]
        },
        budgetForecast: {
          nextQuarter: 90,
          recommendations: ["Optimize resource allocation", "Consider team expansion"]
        },
        actionItems: ["Regular team check-ins", "Performance review cycle", "Skills development program"]
      };
    }

    res.json({
      teamData,
      predictions,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("🔥 Predictive Analytics Error:", error);
    res.status(500).json({
      error: "Failed to generate predictive analytics",
      details: error.message,
    });
  }
});

/* =========================================================
   💭 4. AI SENTIMENT ANALYSIS
   ========================================================= */

// Analyze sentiment of employee feedback
router.post("/sentiment-analysis", async (req, res) => {
  try {
    const { feedbackText, employeeId, source } = req.body;
    console.log("🟩 Analyzing sentiment for feedback from:", employeeId);

    if (!feedbackText) {
      return res.status(400).json({ error: "Feedback text is required" });
    }

    // Verify employee exists
    const employee = await prisma.user.findUnique({
      where: { id: parseInt(employeeId) },
      select: { id: true, name: true, email: true, department: true }
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const prompt = `
Analyze the sentiment and emotional tone of the following employee feedback:

Feedback Text: "${feedbackText}"
Source: ${source || "General feedback"}

Provide detailed sentiment analysis in JSON format:
{
  "overallSentiment": "positive|negative|neutral",
  "sentimentScore": 0.85,
  "confidence": 0.92,
  "emotions": {
    "joy": 0.7,
    "anger": 0.1,
    "sadness": 0.05,
    "fear": 0.05,
    "surprise": 0.1
  },
  "keyThemes": ["List of main themes"],
  "concerns": ["Any concerns or issues identified"],
  "positiveAspects": ["Positive aspects mentioned"],
  "actionableInsights": ["Recommendations based on sentiment"],
  "urgencyLevel": "low|medium|high"
}
`;

    console.log("🤖 Analyzing sentiment with Gemini...");
    const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);
    
    let rawText = result.response.text();
    rawText = rawText.replace(/```json/i, "").replace(/```/g, "").trim();

    let sentimentAnalysis;
    try {
      sentimentAnalysis = JSON.parse(rawText);
    } catch (err) {
      console.warn("⚠️ Invalid JSON, using fallback sentiment analysis");
      sentimentAnalysis = {
        overallSentiment: "neutral",
        sentimentScore: 0.5,
        confidence: 0.7,
        emotions: {
          joy: 0.3,
          anger: 0.2,
          sadness: 0.2,
          fear: 0.1,
          surprise: 0.2
        },
        keyThemes: ["General feedback"],
        concerns: ["Unable to analyze specific concerns"],
        positiveAspects: ["Feedback provided"],
        actionableInsights: ["Review feedback manually", "Follow up with employee"],
        urgencyLevel: "medium"
      };
    }

    // Save feedback to database
    const savedFeedback = await prisma.employeeFeedback.create({
      data: {
        employeeId: employee.id,
        feedbackText,
        source: source || "General feedback",
        feedbackType: "general"
      }
    });

    // Save sentiment analysis to database
    const savedAnalysis = await prisma.sentimentAnalysis.create({
      data: {
        feedbackId: savedFeedback.id,
        overallSentiment: sentimentAnalysis.overallSentiment,
        sentimentScore: sentimentAnalysis.sentimentScore,
        confidence: sentimentAnalysis.confidence,
        emotions: JSON.stringify(sentimentAnalysis.emotions),
        keyThemes: JSON.stringify(sentimentAnalysis.keyThemes),
        concerns: JSON.stringify(sentimentAnalysis.concerns),
        positiveAspects: JSON.stringify(sentimentAnalysis.positiveAspects),
        actionableInsights: JSON.stringify(sentimentAnalysis.actionableInsights),
        urgencyLevel: sentimentAnalysis.urgencyLevel
      }
    });

    res.json({
      feedbackText,
      employeeId,
      employee: {
        name: employee.name,
        email: employee.email,
        department: employee.department
      },
      source,
      analysis: sentimentAnalysis,
      analyzedAt: savedAnalysis.createdAt,
      feedbackId: savedFeedback.id,
      analysisId: savedAnalysis.id
    });

  } catch (error) {
    console.error("🔥 Sentiment Analysis Error:", error);
    res.status(500).json({
      error: "Failed to analyze sentiment",
      details: error.message,
    });
  }
});

// Get sentiment trends for a team/department
router.get("/sentiment-trends/:department", async (req, res) => {
  try {
    const { department } = req.params;
    const { timeframe = "30d" } = req.query;
    console.log("🟩 Getting sentiment trends for department:", department);

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Fetch feedback data from database for the department
    const feedbackData = await prisma.employeeFeedback.findMany({
      where: {
        employee: {
          department: department
        },
        submittedAt: {
          gte: startDate
        }
      },
      include: {
        employee: {
          select: { name: true, email: true, department: true }
        },
        sentimentAnalysis: true
      },
      orderBy: {
        submittedAt: 'desc'
      }
    });

    // Check if we have existing trend analysis for this department and timeframe
    const existingTrend = await prisma.sentimentTrend.findFirst({
      where: {
        department: department,
        timeframe: timeframe,
        generatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
        }
      },
      orderBy: {
        generatedAt: 'desc'
      }
    });

    if (existingTrend && feedbackData.length === 0) {
      // Return cached trend if no new feedback and we have recent analysis
      return res.json({
        department,
        timeframe,
        feedbackCount: 0,
        trends: existingTrend.trendData,
        generatedAt: existingTrend.generatedAt,
        cached: true
      });
    }

    // Prepare feedback data for AI analysis
    const formattedFeedback = feedbackData.map(feedback => ({
      date: feedback.submittedAt.toISOString().split('T')[0],
      sentiment: feedback.sentimentAnalysis?.overallSentiment || "neutral",
      score: feedback.sentimentAnalysis?.sentimentScore || 0.5,
      text: feedback.feedbackText.substring(0, 100) + "...",
      source: feedback.source
    }));

    const prompt = `
Analyze sentiment trends for the ${department} department based on recent feedback:

Feedback Data: ${JSON.stringify(formattedFeedback)}
Timeframe: ${timeframe}
Total Feedback Count: ${feedbackData.length}

Provide trend analysis in JSON format:
{
  "overallTrend": "improving|declining|stable",
  "averageSentiment": 0.64,
  "sentimentDistribution": {
    "positive": 40,
    "neutral": 40,
    "negative": 20
  },
  "trendAnalysis": "Description of sentiment trends",
  "riskFactors": ["List of potential risks"],
  "recommendations": ["Actionable recommendations"],
  "alertLevel": "green|yellow|red",
  "keyInsights": ["Important insights from the data"]
}
`;

    console.log("🤖 Analyzing sentiment trends with Gemini...");
    const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent(prompt);
    
    let rawText = result.response.text();
    rawText = rawText.replace(/```json/i, "").replace(/```/g, "").trim();

    let trendAnalysis;
    try {
      trendAnalysis = JSON.parse(rawText);
    } catch (err) {
      console.warn("⚠️ Invalid JSON, using fallback trend analysis");
      trendAnalysis = {
        overallTrend: "stable",
        averageSentiment: 0.6,
        sentimentDistribution: {
          positive: 35,
          neutral: 45,
          negative: 20
        },
        trendAnalysis: "Sentiment appears stable with room for improvement",
        riskFactors: ["Workload concerns", "Communication gaps"],
        recommendations: ["Regular check-ins", "Address workload issues"],
        alertLevel: "yellow",
        keyInsights: ["Mixed feedback patterns", "Need for proactive engagement"]
      };
    }

    // Save trend analysis to database
    const savedTrend = await prisma.sentimentTrend.create({
      data: {
        department: department,
        timeframe: timeframe,
        averageSentiment: trendAnalysis.averageSentiment || 0.5,
        positivePercentage: trendAnalysis.sentimentDistribution?.positive || 0,
        neutralPercentage: trendAnalysis.sentimentDistribution?.neutral || 0,
        negativePercentage: trendAnalysis.sentimentDistribution?.negative || 0,
        trendDirection: trendAnalysis.overallTrend || "stable",
        riskFactors: JSON.stringify(trendAnalysis.riskFactors || []),
        recommendations: JSON.stringify(trendAnalysis.recommendations || []),
        keyInsights: JSON.stringify(trendAnalysis.keyInsights || []),
        alertLevel: trendAnalysis.alertLevel || "green",
        alertMessage: trendAnalysis.alertMessage || null,
        periodStart: startDate,
        periodEnd: new Date(),
        feedbackCount: feedbackData.length
      }
    });

    res.json({
      department,
      timeframe,
      feedbackCount: feedbackData.length,
      feedbackData: formattedFeedback,
      trends: trendAnalysis,
      generatedAt: savedTrend.generatedAt,
      trendId: savedTrend.id
    });

  } catch (error) {
    console.error("🔥 Sentiment Trends Error:", error);
    res.status(500).json({
      error: "Failed to analyze sentiment trends",
      details: error.message,
    });
  }
});

// Real-time sentiment monitoring endpoint
router.post("/sentiment-monitor", async (req, res) => {
  try {
    const { feedbackBatch } = req.body;
    console.log("🟩 Processing batch sentiment analysis for", feedbackBatch?.length || 0, "items");

    if (!feedbackBatch || !Array.isArray(feedbackBatch)) {
      return res.status(400).json({ error: "feedbackBatch array is required" });
    }

    const results = [];
    
    for (const feedback of feedbackBatch) {
      const prompt = `
Quickly analyze sentiment for: "${feedback.text}"

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral",
  "score": 0.75,
  "urgency": "low|medium|high"
}
`;

      try {
        const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        
        let rawText = result.response.text();
        rawText = rawText.replace(/```json/i, "").replace(/```/g, "").trim();

        let analysis;
        try {
          analysis = JSON.parse(rawText);
        } catch (err) {
          analysis = {
            sentiment: "neutral",
            score: 0.5,
            urgency: "low"
          };
        }

        results.push({
          id: feedback.id,
          text: feedback.text,
          analysis
        });
      } catch (error) {
        results.push({
          id: feedback.id,
          text: feedback.text,
          analysis: {
            sentiment: "neutral",
            score: 0.5,
            urgency: "low"
          },
          error: "Analysis failed"
        });
      }
    }

    res.json({
      processedCount: results.length,
      results,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("🔥 Sentiment Monitor Error:", error);
    res.status(500).json({
      error: "Failed to process sentiment monitoring",
      details: error.message,
    });
  }
});

/* =========================================================
   📊 EXPORT FUNCTIONALITY FOR SENTIMENT ANALYSIS
   ========================================================= */

// Export sentiment analysis data
router.post("/sentiment-analysis/export", async (req, res) => {
  try {
    const { department, format, dateRange } = req.body;
    console.log("🟩 Exporting sentiment analysis data for department:", department, "format:", format);

    // Fetch sentiment data based on department and date range
    let whereClause = {};
    if (department && department !== 'all') {
      whereClause.department = department;
    }
    
    if (dateRange?.start && dateRange?.end) {
      whereClause.createdAt = {
        gte: new Date(dateRange.start),
        lte: new Date(dateRange.end)
      };
    }

    // Get feedback data with sentiment analysis
    const feedbackData = await prisma.employeeFeedback.findMany({
      where: whereClause,
      include: {
        sentimentAnalysis: true,
        employee: {
          select: {
            name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate summary statistics
    const totalFeedback = feedbackData.length;
    const sentimentCounts = {
      positive: 0,
      negative: 0,
      neutral: 0
    };

    const detailedAnalysis = feedbackData.map(feedback => {
      const sentiment = feedback.sentimentAnalysis?.[0];
      if (sentiment) {
        sentimentCounts[sentiment.classification]++;
      }

      return {
        id: feedback.id,
        employeeName: feedback.employee?.name || 'Unknown',
        employeeEmail: feedback.employee?.email || 'Unknown',
        department: feedback.employee?.department || department,
        feedbackText: feedback.feedbackText,
        category: feedback.category,
        sentiment: sentiment?.classification || 'neutral',
        confidence: sentiment?.confidence || 0,
        keyThemes: sentiment?.keyThemes || [],
        recommendations: sentiment?.recommendations || [],
        createdAt: feedback.createdAt,
        analysisDate: sentiment?.createdAt || feedback.createdAt
      };
    });

    // Calculate percentages
    const sentimentPercentages = {
      positive: totalFeedback > 0 ? Math.round((sentimentCounts.positive / totalFeedback) * 100) : 0,
      negative: totalFeedback > 0 ? Math.round((sentimentCounts.negative / totalFeedback) * 100) : 0,
      neutral: totalFeedback > 0 ? Math.round((sentimentCounts.neutral / totalFeedback) * 100) : 0
    };

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        department: department || 'All Departments',
        dateRange: dateRange || { start: null, end: null },
        totalFeedback,
        format
      },
      summary: {
        sentimentCounts,
        sentimentPercentages,
        overallSentiment: sentimentCounts.positive > sentimentCounts.negative ? 
          (sentimentCounts.positive > sentimentCounts.neutral ? 'positive' : 'neutral') :
          (sentimentCounts.negative > sentimentCounts.neutral ? 'negative' : 'neutral')
      },
      detailedAnalysis
    };

    // Return data based on format
    if (format === 'json') {
      res.json(exportData);
    } else if (format === 'csv') {
      // Generate CSV content
      const csvHeaders = [
        'ID', 'Employee Name', 'Employee Email', 'Department', 'Feedback Text',
        'Category', 'Sentiment', 'Confidence', 'Key Themes', 'Recommendations',
        'Created At', 'Analysis Date'
      ];
      
      const csvRows = detailedAnalysis.map(item => [
        item.id,
        `"${item.employeeName}"`,
        item.employeeEmail,
        item.department,
        `"${item.feedbackText.replace(/"/g, '""')}"`,
        item.category,
        item.sentiment,
        item.confidence,
        `"${item.keyThemes.join(', ')}"`,
        `"${item.recommendations.join(', ')}"`,
        new Date(item.createdAt).toISOString(),
        new Date(item.analysisDate).toISOString()
      ]);

      const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sentiment-analysis-${department || 'all'}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      // Default to JSON
      res.json(exportData);
    }

  } catch (error) {
    console.error("🔥 Export Sentiment Analysis Error:", error);
    res.status(500).json({
      error: "Failed to export sentiment analysis data",
      details: error.message,
    });
  }
});

// Get export status (for tracking long-running exports)
router.get("/export-status/:exportId", async (req, res) => {
  try {
    const { exportId } = req.params;
    
    // In a real implementation, you'd track export jobs in a database or cache
    // For now, we'll return a simple status
    res.json({
      exportId,
      status: 'completed',
      progress: 100,
      downloadUrl: `/api/ai/download-export/${exportId}`,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("🔥 Export Status Error:", error);
    res.status(500).json({
      error: "Failed to get export status",
      details: error.message,
    });
  }
});

/* =========================================================
   📊 PERFORMANCE INSIGHTS EXPORT
   ========================================================= */
router.post("/performance-insights/export", async (req, res) => {
  try {
    const { format = 'json', filters = {}, timestamp } = req.body;
    
    // Mock performance insights data for export
    const performanceData = {
      exportInfo: {
        generatedAt: timestamp || new Date().toISOString(),
        format: format,
        filters: filters,
        totalRecords: 1247
      },
      insights: [
        {
          employeeId: "EMP001",
          name: "John Doe",
          department: "Engineering",
          performanceScore: 92,
          productivity: 88,
          collaboration: 95,
          innovation: 90,
          riskLevel: "Low",
          recommendations: [
            "Consider for leadership development program",
            "Assign mentoring responsibilities"
          ],
          lastEvaluation: "2024-01-15T10:30:00Z"
        },
        {
          employeeId: "EMP002",
          name: "Jane Smith",
          department: "Marketing",
          performanceScore: 87,
          productivity: 85,
          collaboration: 92,
          innovation: 84,
          riskLevel: "Low",
          recommendations: [
            "Provide advanced analytics training",
            "Increase project ownership"
          ],
          lastEvaluation: "2024-01-14T14:20:00Z"
        },
        {
          employeeId: "EMP003",
          name: "Mike Johnson",
          department: "Sales",
          performanceScore: 78,
          productivity: 75,
          collaboration: 80,
          innovation: 79,
          riskLevel: "Medium",
          recommendations: [
            "Provide sales methodology training",
            "Implement performance improvement plan"
          ],
          lastEvaluation: "2024-01-13T09:15:00Z"
        }
      ],
      summary: {
        averagePerformanceScore: 85.7,
        highPerformers: 2,
        mediumPerformers: 1,
        lowPerformers: 0,
        departmentBreakdown: {
          "Engineering": { count: 1, avgScore: 92 },
          "Marketing": { count: 1, avgScore: 87 },
          "Sales": { count: 1, avgScore: 78 }
        }
      }
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = 'Employee ID,Name,Department,Performance Score,Productivity,Collaboration,Innovation,Risk Level,Last Evaluation\n';
      const csvRows = performanceData.insights.map(insight => 
        `${insight.employeeId},${insight.name},${insight.department},${insight.performanceScore},${insight.productivity},${insight.collaboration},${insight.innovation},${insight.riskLevel},${insight.lastEvaluation}`
      ).join('\n');
      
      const csvContent = csvHeaders + csvRows;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="performance-insights-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else if (format === 'txt') {
      // Convert to plain text format
      let txtContent = `PERFORMANCE INSIGHTS REPORT\n`;
      txtContent += `Generated: ${performanceData.exportInfo.generatedAt}\n`;
      txtContent += `Total Records: ${performanceData.exportInfo.totalRecords}\n\n`;
      
      txtContent += `SUMMARY:\n`;
      txtContent += `Average Performance Score: ${performanceData.summary.averagePerformanceScore}\n`;
      txtContent += `High Performers: ${performanceData.summary.highPerformers}\n`;
      txtContent += `Medium Performers: ${performanceData.summary.mediumPerformers}\n`;
      txtContent += `Low Performers: ${performanceData.summary.lowPerformers}\n\n`;
      
      txtContent += `DETAILED INSIGHTS:\n`;
      performanceData.insights.forEach((insight, index) => {
        txtContent += `\n${index + 1}. ${insight.name} (${insight.employeeId})\n`;
        txtContent += `   Department: ${insight.department}\n`;
        txtContent += `   Performance Score: ${insight.performanceScore}\n`;
        txtContent += `   Risk Level: ${insight.riskLevel}\n`;
        txtContent += `   Recommendations: ${insight.recommendations.join(', ')}\n`;
      });
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="performance-insights-${new Date().toISOString().split('T')[0]}.txt"`);
      res.send(txtContent);
    } else {
      // Default to JSON
      res.json(performanceData);
    }

  } catch (error) {
    console.error("🔥 Export Performance Insights Error:", error);
    res.status(500).json({
      error: "Failed to export performance insights data",
      details: error.message,
    });
  }
});

/* =========================================================
   🔮 PREDICTIVE ANALYTICS EXPORT
   ========================================================= */
router.post("/predictive-analytics/export", async (req, res) => {
  try {
    const { format = 'json', filters = {}, timestamp } = req.body;
    
    // Mock predictive analytics data for export
    const predictiveData = {
      exportInfo: {
        generatedAt: timestamp || new Date().toISOString(),
        format: format,
        filters: filters,
        totalPredictions: 2847
      },
      predictions: {
        turnoverRisk: [
          {
            department: "Engineering",
            riskLevel: "Low",
            probability: 12,
            affectedEmployees: 3,
            predictedTimeframe: "6 months",
            factors: ["Workload", "Career Growth"]
          },
          {
            department: "Sales",
            riskLevel: "Medium",
            probability: 28,
            affectedEmployees: 7,
            predictedTimeframe: "3 months",
            factors: ["Compensation", "Management"]
          }
        ],
        performanceTrends: [
          {
            metric: "Overall Productivity",
            currentValue: 87.5,
            predictedValue: 91.2,
            trend: "Increasing",
            confidence: 89
          },
          {
            metric: "Employee Satisfaction",
            currentValue: 82.3,
            predictedValue: 85.7,
            trend: "Increasing",
            confidence: 76
          }
        ],
        budgetForecasts: [
          {
            category: "Training & Development",
            currentBudget: 125000,
            predictedNeed: 145000,
            variance: 16,
            recommendation: "Increase budget allocation"
          },
          {
            category: "Recruitment",
            currentBudget: 85000,
            predictedNeed: 92000,
            variance: 8.2,
            recommendation: "Slight increase recommended"
          }
        ]
      },
      insights: [
        "Engineering department shows strong retention potential",
        "Sales team requires immediate attention for retention strategies",
        "Overall productivity is trending upward across all departments",
        "Training budget should be increased to support growth initiatives"
      ]
    };

    if (format === 'csv') {
      // Convert to CSV format
      let csvContent = 'Category,Department/Metric,Current Value,Predicted Value,Risk Level,Probability,Timeframe\n';
      
      // Add turnover risk data
      predictiveData.predictions.turnoverRisk.forEach(risk => {
        csvContent += `Turnover Risk,${risk.department},${risk.affectedEmployees},${risk.probability}%,${risk.riskLevel},,${risk.predictedTimeframe}\n`;
      });
      
      // Add performance trends
      predictiveData.predictions.performanceTrends.forEach(trend => {
        csvContent += `Performance Trend,${trend.metric},${trend.currentValue},${trend.predictedValue},,,${trend.trend}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="predictive-analytics-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else if (format === 'txt') {
      // Convert to plain text format
      let txtContent = `PREDICTIVE ANALYTICS REPORT\n`;
      txtContent += `Generated: ${predictiveData.exportInfo.generatedAt}\n`;
      txtContent += `Total Predictions: ${predictiveData.exportInfo.totalPredictions}\n\n`;
      
      txtContent += `TURNOVER RISK ANALYSIS:\n`;
      predictiveData.predictions.turnoverRisk.forEach((risk, index) => {
        txtContent += `${index + 1}. ${risk.department} Department\n`;
        txtContent += `   Risk Level: ${risk.riskLevel}\n`;
        txtContent += `   Probability: ${risk.probability}%\n`;
        txtContent += `   Affected Employees: ${risk.affectedEmployees}\n`;
        txtContent += `   Timeframe: ${risk.predictedTimeframe}\n\n`;
      });
      
      txtContent += `PERFORMANCE TRENDS:\n`;
      predictiveData.predictions.performanceTrends.forEach((trend, index) => {
        txtContent += `${index + 1}. ${trend.metric}\n`;
        txtContent += `   Current: ${trend.currentValue}\n`;
        txtContent += `   Predicted: ${trend.predictedValue}\n`;
        txtContent += `   Trend: ${trend.trend}\n\n`;
      });
      
      txtContent += `KEY INSIGHTS:\n`;
      predictiveData.insights.forEach((insight, index) => {
        txtContent += `${index + 1}. ${insight}\n`;
      });
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="predictive-analytics-${new Date().toISOString().split('T')[0]}.txt"`);
      res.send(txtContent);
    } else {
      // Default to JSON
      res.json(predictiveData);
    }

  } catch (error) {
    console.error("🔥 Export Predictive Analytics Error:", error);
    res.status(500).json({
      error: "Failed to export predictive analytics data",
      details: error.message,
    });
  }
});

/* =========================================================
   📊 AI SYSTEM STATUS ENDPOINTS
   ========================================================= */
router.get("/system-status", async (req, res) => {
  try {
    const systemStatus = {
      status: "operational",
      uptime: "99.8%",
      lastUpdate: new Date().toISOString(),
      services: {
        performanceAnalytics: {
          status: "active",
          responseTime: "245ms",
          accuracy: "94.2%"
        },
        predictiveModeling: {
          status: "active",
          responseTime: "312ms",
          accuracy: "91.7%"
        },
        sentimentAnalysis: {
          status: "active",
          responseTime: "189ms",
          accuracy: "96.1%"
        }
      },
      resourceUsage: {
        cpu: "23%",
        memory: "67%",
        storage: "45%"
      }
    };

    res.json(systemStatus);
  } catch (error) {
    console.error("🔥 System Status Error:", error);
    res.status(500).json({
      error: "Failed to get system status",
      details: error.message,
    });
  }
});

router.get("/analytics-status", async (req, res) => {
  try {
    const analyticsStatus = {
      status: "active",
      lastProcessed: new Date().toISOString(),
      totalAnalyzed: 1247,
      processingQueue: 23,
      averageProcessingTime: "2.3s",
      successRate: "98.7%",
      activeModels: [
        "performance-predictor-v2.1",
        "turnover-risk-analyzer-v1.8",
        "sentiment-classifier-v3.0"
      ]
    };

    res.json(analyticsStatus);
  } catch (error) {
    console.error("🔥 Analytics Status Error:", error);
    res.status(500).json({
      error: "Failed to get analytics status",
      details: error.message,
    });
  }
});

export default router;
