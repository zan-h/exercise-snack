import { type NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File | null
    const step = formData.get("step") as string | null

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    if (step === null) {
      return NextResponse.json({ error: "No step provided" }, { status: 400 })
    }

    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const model = openai("whisper-1")
    const { text } = await generateText({
      model,
      prompt: `Transcribe the following audio. The question being answered is: "${getQuestionForStep(Number.parseInt(step))}"`,
      audio: buffer,
    })

    if (!text) {
      throw new Error("No transcript generated")
    }

    return NextResponse.json({ transcript: text })
  } catch (error) {
    console.error("Error in /api/transcribe:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 },
    )
  }
}

function getQuestionForStep(step: number): string {
  const questions = ["How much time do you have?", "What's your energy level?", "What's your desired outcome?"]
  return questions[step] || ""
}

