# AI Study Assistant - Backend Implementation Plan (serverauthforrustapp)

This document outlines the plan for the backend portion of the AI Study Assistant feature within the `serverauthforrustapp` project.

## Architecture Overview

The backend (`serverauthforrustapp`) serves as the brain for the AI Study Assistant. Its primary responsibilities are:

1.  **API Endpoint:** Expose an API endpoint (`POST /api/ai/chat`) to receive user messages from the `webgui` frontend.
2.  **Request Handling:** Process incoming requests, potentially validating input or checking user authentication (if implemented later).
3.  **AI Orchestration:** Analyze the user's message to determine the intent (e.g., request for explanation, quiz request, general chat). This will involve replacing the current placeholder logic in `aiController.js` with calls to a more sophisticated orchestration mechanism or AI model.
4.  **Agent Delegation:** Based on the determined intent, delegate the task to the appropriate specialized AI agent/service (e.g., call an "Explainer" service, a "Quiz Generator" service). These agents might be separate internal modules, external microservices, or calls to third-party AI APIs (like OpenAI, Gemini, etc.).
5.  **Response Aggregation:** Receive the results from the specialized agent(s).
6.  **Response Formatting:** Format the results into the JSON structure expected by the frontend (e.g., `{ sender: 'ai', text: '...' }` or `{ sender: 'ai', quizData: {...} }`).
7.  **API Response:** Send the final JSON response back to the `webgui` frontend.

## Current Status (as of completion of initial setup)

*   New route file `routes/aiRoutes.js` created, defining the `POST /chat` route.
*   New controller file `controllers/aiController.js` created with a `handleChatMessage` function.
*   The `aiRoutes` router is mounted under `/api/ai` in `server.js`.
*   The `handleChatMessage` function currently implements *placeholder* orchestration logic:
    *   It checks for keywords ("quiz", "explain") in the user message.
    *   It returns different hardcoded JSON responses based on the detected keyword, simulating intent.
*   No actual AI models or external services are integrated yet.

## Next Steps (Backend)

1.  **Orchestration Implementation:** Replace the placeholder keyword logic in `aiController.js` with a call to a real orchestration service or AI model (e.g., a function that uses a large language model like Gemini or OpenAI's API) to perform more robust intent recognition and context management.
2.  **Agent Service Integration:**
    *   Define the interfaces/APIs for the specialized agents (Explainer, Quiz Generator).
    *   Implement or integrate these agents. This might involve:
        *   Creating new modules/controllers within this backend.
        *   Calling external microservices.
        *   Making API calls to third-party AI services (requiring API key management, likely using `.env`).
3.  **Dynamic Response Generation:** Modify the `handleChatMessage` function (or the orchestrator it calls) to use the results from the specialized agents to construct the actual response sent back to the frontend (e.g., insert the generated explanation text, format the quiz data).
4.  **Error Handling:** Implement robust error handling for AI service calls and internal processing.
5.  **(Optional) Authentication:** Add authentication middleware (e.g., using the existing `verifyToken` or similar from `middleware/`) to the `/api/ai` route if the feature should be restricted to logged-in users.
6.  **(Optional) Database Integration:** Consider if chat history or user progress needs to be stored in the PostgreSQL database. If so, design the necessary table schema and implement database interactions.

## Interaction Flow (Backend Focus)

1.  Frontend sends POST request to `/api/ai/chat` with `{ message: "User's text" }`.
2.  `server.js` routes the request to `aiRoutes.js`.
3.  `aiRoutes.js` routes the request to `aiController.js`'s `handleChatMessage` function.
4.  `handleChatMessage` extracts the message.
5.  **(Future)** `handleChatMessage` calls the AI Orchestrator logic/service with the message.
6.  **(Future)** Orchestrator determines intent (e.g., 'explain_topic').
7.  **(Future)** Orchestrator calls the appropriate agent (e.g., Explainer service/API).
8.  **(Future)** Agent processes the request and returns the result (e.g., explanation text).
9.  **(Future)** Orchestrator receives the result.
10. `handleChatMessage` (or Orchestrator) formats the result into the response JSON.
11. `handleChatMessage` sends the JSON response back to the frontend.