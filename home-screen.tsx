"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, Settings, StopCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface WorkoutState {
  time: string
  energyLevel: string
  desiredOutcome: string
}

export default function HomeScreen() {
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [recordingStep, setRecordingStep] = useState(0)
  const [workoutState, setWorkoutState] = useState<WorkoutState>({
    time: "",
    energyLevel: "",
    desiredOutcome: "",
  })
  const [response, setResponse] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [transcript, setTranscript] = useState("")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const steps = ["How much time do you have?", "What's your energy level?", "What's your desired outcome?"]

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        sendAudioToServer(audioBlob)
        audioChunksRef.current = []
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Error accessing microphone:", err)
      setError("Failed to access microphone. Please check your permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const sendAudioToServer = async (audioBlob: Blob) => {
    setIsLoading(true)
    const formData = new FormData()
    formData.append("audio", audioBlob, "recording.wav")
    formData.append("step", recordingStep.toString())

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (!data.transcript) {
        throw new Error("No transcript received from server")
      }

      setTranscript(data.transcript)

      // Update workout state
      setWorkoutState((prev) => {
        const key = recordingStep === 0 ? "time" : recordingStep === 1 ? "energyLevel" : "desiredOutcome"
        return { ...prev, [key]: data.transcript.trim() }
      })

      // Move to next step or finish recording
      if (recordingStep < steps.length - 1) {
        setRecordingStep((prev) => prev + 1)
        setProgress((recordingStep + 1) * (100 / steps.length))
      } else {
        generateWorkout()
      }
    } catch (err) {
      console.error("Error sending audio to server:", err)
      setError(`Failed to process audio: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVoiceButton = async () => {
    if (!isRecording) {
      setProgress(0)
      setRecordingStep(0)
      setError("")
      setWorkoutState({
        time: "",
        energyLevel: "",
        desiredOutcome: "",
      })
      startRecording()
    } else {
      stopRecording()
    }
  }

  const generateWorkout = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/workout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workoutState),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      let workoutResponse = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = new TextDecoder().decode(value)
        workoutResponse += text
        setResponse(workoutResponse)
      }
    } catch (err) {
      console.error("Error generating workout:", err)
      setError(`Failed to generate workout: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4">
      {/* Status Bar */}
      <div className="h-6 mb-4"></div>

      {/* Settings Button */}
      <div className="flex justify-end mb-8">
        <Button variant="ghost" size="icon" className="w-10 h-10">
          <Settings className="h-6 w-6" />
          <span className="sr-only">Settings</span>
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col items-center justify-center space-y-8">
        <h1 className="text-2xl font-bold text-center">Exercise Snack</h1>

        {error && (
          <Alert variant="destructive" className="max-w-md">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!response && (
          <>
            <p className="text-center text-gray-600 max-w-xs">
              {isRecording ? steps[recordingStep] : "Tap the button and answer the prompts"}
            </p>

            {/* Current Input Display */}
            {transcript && <p className="text-sm text-blue-600 max-w-xs text-center">I heard: {transcript}</p>}

            {/* Voice Input Button */}
            <Button
              onClick={handleVoiceButton}
              className={`w-32 h-32 rounded-full transition-all duration-300 ease-in-out ${
                isRecording ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
              } focus:ring-4 focus:ring-blue-300`}
              aria-label={isRecording ? "Stop Recording" : "Start Recording"}
              disabled={isLoading}
            >
              {isRecording ? <StopCircle className="h-16 w-16 text-white" /> : <Mic className="h-16 w-16 text-white" />}
            </Button>

            <Progress value={progress} className="w-64" />

            {/* Display current workout state */}
            {(workoutState.time || workoutState.energyLevel || workoutState.desiredOutcome) && (
              <div className="text-sm text-gray-600 space-y-2 max-w-xs">
                {workoutState.time && <p>Time: {workoutState.time}</p>}
                {workoutState.energyLevel && <p>Energy Level: {workoutState.energyLevel}</p>}
                {workoutState.desiredOutcome && <p>Goal: {workoutState.desiredOutcome}</p>}
              </div>
            )}
          </>
        )}

        {/* Workout Response */}
        {response && (
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Your Workout</h2>
            <div className="whitespace-pre-wrap">{response}</div>
            <Button
              onClick={() => {
                setResponse("")
                setWorkoutState({ time: "", energyLevel: "", desiredOutcome: "" })
                setTranscript("")
              }}
              className="mt-4"
            >
              Create New Workout
            </Button>
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-center text-gray-500">
            {transcript ? "Generating your personalized workout..." : "Processing your audio..."}
          </p>
        )}
      </div>
    </div>
  )
}

