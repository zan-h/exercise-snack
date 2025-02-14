import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

export async function POST(req: Request) {
  const { time, energyLevel, desiredOutcome } = await req.json()

  const prompt = `Create a quick workout routine with these parameters:
    - Available time: ${time}
    - Current energy level: ${energyLevel}
    - Desired outcome: ${desiredOutcome}
    
    Format the response as a structured workout with:
    1. Warm-up
    2. Main exercises (with reps/duration)
    3. Cool-down
    Keep it concise and achievable within the time limit.`

  const result = streamText({
    model: openai("gpt-3.5-turbo"),
    messages: [
      {
        role: "system",
        content: "You are a knowledgeable fitness instructor who specializes in quick, effective workouts.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  })

  return result.toDataStreamResponse()
}

