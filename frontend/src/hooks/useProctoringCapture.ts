import { useEffect, useRef, useCallback } from 'react'

interface UseProctoringOptions {
    sessionId: string | null
    sendFrame: (sessionId: string, base64: string) => void
    sendAudio: (sessionId: string, base64: string) => void
    sendEvent: (sessionId: string, type: string) => void
    onCameraError?: (err: string) => void
}

export function useProctoringCapture({
    sessionId,
    sendFrame,
    sendAudio,
    sendEvent,
    onCameraError,
}: UseProctoringOptions) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const captureFrame = useCallback(() => {
        if (!sessionId || !videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video.readyState < 2) return

        canvas.width = 320
        canvas.height = 240
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0, 320, 240)
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]
        sendFrame(sessionId, base64)
    }, [sessionId, sendFrame])

    const flushAudio = useCallback(() => {
        if (!sessionId || audioChunksRef.current.length === 0) return
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1]
            sendAudio(sessionId, base64)
        }
        reader.readAsDataURL(blob)
        audioChunksRef.current = []
    }, [sessionId, sendAudio])

    const startCapture = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            streamRef.current = stream

            // Setup video
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }

            // Setup audio recorder
            const audioStream = new MediaStream(stream.getAudioTracks())
            const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' })
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data)
            }
            recorder.start(1000) // collect data every 1s
            mediaRecorderRef.current = recorder

            // Frame capture every 2 seconds
            frameTimerRef.current = setInterval(captureFrame, 2000)

            // Audio flush every 10 seconds
            audioTimerRef.current = setInterval(flushAudio, 10000)
        } catch (err) {
            onCameraError?.(err instanceof Error ? err.message : 'Camera access denied')
        }
    }, [captureFrame, flushAudio, onCameraError])

    const stopCapture = useCallback(() => {
        if (frameTimerRef.current) clearInterval(frameTimerRef.current)
        if (audioTimerRef.current) clearInterval(audioTimerRef.current)
        mediaRecorderRef.current?.stop()
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
    }, [])

    // Fullscreen enforcement
    useEffect(() => {
        if (!sessionId) return

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                sendEvent(sessionId, 'FULLSCREEN_EXIT')
                // Re-request fullscreen
                document.documentElement.requestFullscreen().catch(() => { })
            }
        }

        const handleVisibilityChange = () => {
            if (document.hidden) sendEvent(sessionId, 'TAB_SWITCH')
        }

        const handleBlur = () => sendEvent(sessionId, 'TAB_SWITCH')

        const handleCopy = (e: ClipboardEvent) => {
            e.preventDefault()
            sendEvent(sessionId, 'COPY_PASTE')
        }

        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault()
            sendEvent(sessionId, 'COPY_PASTE')
        }

        const handleContextMenu = (e: MouseEvent) => e.preventDefault()

        const handleKeyDown = (e: KeyboardEvent) => {
            // Block F12, Ctrl+Shift+I, Ctrl+U, Ctrl+C, Ctrl+V, etc.
            if (e.key === 'F12') e.preventDefault()
            if (e.ctrlKey && ['c', 'v', 'u', 's', 'a'].includes(e.key.toLowerCase())) {
                e.preventDefault()
                if (['c', 'v'].includes(e.key.toLowerCase())) sendEvent(sessionId, 'COPY_PASTE')
            }
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('blur', handleBlur)
        document.addEventListener('copy', handleCopy)
        document.addEventListener('paste', handlePaste)
        document.addEventListener('contextmenu', handleContextMenu)
        document.addEventListener('keydown', handleKeyDown)

        // Request fullscreen on mount
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { })
        }

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('blur', handleBlur)
            document.removeEventListener('copy', handleCopy)
            document.removeEventListener('paste', handlePaste)
            document.removeEventListener('contextmenu', handleContextMenu)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [sessionId, sendEvent])

    return { videoRef, canvasRef, startCapture, stopCapture }
}
