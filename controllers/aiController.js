// serverauthforrustapp/controllers/aiController.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config(); // Ensure environment variables are loaded

// --- Gemini API Initialization ---
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('FATAL ERROR: GOOGLE_API_KEY not found in environment variables. AI features will not work.');
  // In a real app, you might throw an error or exit, but here we'll log and let it fail later.
}

let model; // Declare model variable

try {
    if (API_KEY) {
        const genAI = new GoogleGenerativeAI(API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-03-25" });
        console.log("Gemini 2.5 Pro model initialized successfully.");
    } else {
        console.warn("AI Model not initialized due to missing API Key.");
    }
} catch (initError) {
    console.error("Error initializing Google Generative AI:", initError);
    // Handle initialization error appropriately, maybe set model to null or use a fallback
    model = null;
}
// --- End Gemini API Initialization ---


// --- Gemini-Powered Agent Functions ---

const generateExplanation = async (topic, sectionIndex) => {
  console.log(`AI Agent: Generating explanation via Gemini for section ${sectionIndex} of topic "${topic}"...`);
  if (!model) {
      console.error("generateExplanation: AI model not initialized.");
      throw new Error("AI model not available."); // Propagate error
  }

  const prompt = `You are an AI Study Assistant. Explain section ${sectionIndex} of the topic: "${topic}".
Keep the explanation concise and focused on this specific section.
Assume this is part of a larger study session.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log(`AI Agent: Explanation received for section ${sectionIndex}.`);
    return { text: text };
  } catch (error) {
    console.error(`AI Agent: Error generating explanation for section ${sectionIndex} of topic "${topic}":`, error);
    throw new Error('Failed to generate explanation from AI.'); // Re-throw for handleChatMessage
  }
};

const generateQuiz = async (topic, sectionIndex) => {
  console.log(`AI Agent: Generating quiz via Gemini for section ${sectionIndex} of topic "${topic}"...`);
   if (!model) {
      console.error("generateQuiz: AI model not initialized.");
      throw new Error("AI model not available."); // Propagate error
  }

  const prompt = `You are an AI Study Assistant. Generate a short quiz (3-5 multiple-choice questions) covering the key concepts of section ${sectionIndex} of the topic: "${topic}".
IMPORTANT: Respond ONLY with a valid JSON string representing the quiz data. Do not include any other text, explanation, or markdown formatting (like \`\`\`json ... \`\`\`) before or after the JSON.
The JSON structure MUST be exactly:
{
  "title": "Quiz for ${topic} - Section ${sectionIndex}",
  "questions": [
    { "q": "Question text 1?", "opts": ["Option A", "Option B", "Option C"], "ans": "A" },
    { "q": "Question text 2?", "opts": ["Option A", "Option B"], "ans": "B" }
  ]
}
Ensure the 'ans' field contains ONLY the single uppercase letter corresponding to the correct option's position in the 'opts' array (A for the first, B for the second, etc.).`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonString = response.text();
    console.log(`AI Agent: Raw quiz response received for section ${sectionIndex}:`, jsonString); // Log raw response for debugging

    // Attempt to parse the JSON response
    try {
      const parsedQuizObject = JSON.parse(jsonString);
      console.log(`AI Agent: Quiz JSON parsed successfully for section ${sectionIndex}.`);
      // Basic validation (optional but recommended)
      if (!parsedQuizObject || !parsedQuizObject.title || !Array.isArray(parsedQuizObject.questions)) {
          throw new Error("Invalid quiz JSON structure received from AI.");
      }
      return { quizData: parsedQuizObject };
    } catch (parseError) {
      console.error(`AI Agent: Error parsing quiz JSON for section ${sectionIndex} of topic "${topic}":`, parseError);
      console.error("AI Agent: Received non-JSON string:", jsonString); // Log the problematic string
      throw new Error('Failed to parse quiz data from AI response.'); // Re-throw for handleChatMessage
    }
  } catch (error) {
    // Catch errors from the API call itself or re-thrown parsing errors
    console.error(`AI Agent: Error generating or processing quiz for section ${sectionIndex} of topic "${topic}":`, error);
    throw new Error('Failed to generate or process quiz from AI.'); // Re-throw for handleChatMessage
  }
};

// Controller for handling AI chat messages with Explain/Quiz orchestration
const handleChatMessage = async (req, res) => {
  // Extract message (potential new topic) and current study state from request
  const { message, studyState } = req.body;

  console.log('AI Controller received:', { message, studyState });

  try {
    let responsePayload = { sender: 'ai' }; // Initialize response structure

    // Determine if it's a new session or continuation
    if (!studyState || !studyState.topic || !studyState.nextAction) {
      // --- New Study Session ---
      const topic = message; // Assume the message is the initial topic
      if (!topic) {
        console.error('AI Controller: Missing message (topic) for new study session.');
        return res.status(400).json({ error: 'Please provide a topic to start studying.' });
      }

      console.log(`AI Orchestrator: Starting new study session for topic: "${topic}"`);
      const explanation = await generateExplanation(topic, 1); // Start with section 1 explanation
      responsePayload.text = explanation.text;
      // Set the next state: expecting a quiz for section 1 next
      responsePayload.studyState = { topic: topic, nextAction: 'quiz', section: 1 };

    } else {
      // --- Continue Existing Study Session ---
      const { topic, nextAction, section } = studyState;
      console.log(`AI Orchestrator: Continuing study session for topic: "${topic}", section: ${section}, next action: ${nextAction}`);

      if (nextAction === 'quiz') {
        // Generate and return the quiz for the current section
        const quiz = await generateQuiz(topic, section);
        responsePayload.quizData = quiz.quizData;
        // Set the next state: expecting an explanation for the *next* section
        responsePayload.studyState = { topic: topic, nextAction: 'explain', section: section + 1 };
      } else if (nextAction === 'explain') {
        // Generate and return the explanation for the current section
        const explanation = await generateExplanation(topic, section);
        responsePayload.text = explanation.text;
        // Set the next state: expecting a quiz for the *same* section
        responsePayload.studyState = { topic: topic, nextAction: 'quiz', section: section };
      } else {
        // Handle unexpected state defensively
        console.error('AI Orchestrator: Invalid nextAction in studyState:', nextAction);
        responsePayload.text = `Error: Encountered an unexpected study state action ("${nextAction}"). Let's start over. Please provide a topic.`;
        responsePayload.studyState = null; // Reset state
      }
    }

    console.log('AI Controller sending response:', responsePayload);
    res.status(200).json(responsePayload);

  } catch (error) {
    console.error('AI Controller - Error handling chat message:', error.message || error);
    // Send a more specific error response to the client based on the error source
    let errorMessage = 'Sorry, an internal error occurred while processing your request.';
    if (error.message && error.message.includes('Failed to generate explanation')) {
        errorMessage = 'Sorry, there was an error generating the explanation. Please try again.';
    } else if (error.message && error.message.includes('Failed to generate or process quiz')) {
        errorMessage = 'Sorry, there was an error generating the quiz. Please try again.';
    } else if (error.message && error.message.includes('Failed to parse quiz data')) {
        errorMessage = 'Sorry, there was an issue processing the quiz data from the AI. Please try again.';
    } else if (error.message && error.message.includes('AI model not available')) {
        errorMessage = 'Sorry, the AI assistant is currently unavailable. Please check configuration.';
    }

    res.status(500).json({
      sender: 'ai',
      text: errorMessage,
      studyState: studyState || null // Return existing state if possible, or null
    });
  }
};

module.exports = {
  handleChatMessage,
  // Exporting simulated functions might be useful for testing later, but not required by spec
  // generateExplanation,
  // generateQuiz
};