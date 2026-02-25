import { useEffect, useRef, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

interface UseWebSocketOptions {
    sessionId?: string
    examId?: string
    onWarning?: (msg: string) => void
    onSuspend?: (reason: string) => void
    onSessionUpdate?: (data: Record<string, unknown>) => void
    onExamAlert?: (data: Record<string, unknown>) => void
    onAdminAlert?: (data: Record<string, unknown>) => void
}

export function useWebSocket(options: UseWebSocketOptions) {
    const clientRef = useRef<Client | null>(null)
    const connectedRef = useRef(false)

    const send = useCallback((destination: string, body: Record<string, unknown>) => {
        if (clientRef.current?.connected) {
            clientRef.current.publish({
                destination,
                body: JSON.stringify(body),
            })
        }
    }, [])

    const sendFrame = useCallback((sessionId: string, frameBase64: string) => {
        send(`/app/exam/${sessionId}/frame`, { frame: frameBase64 })
    }, [send])

    const sendAudio = useCallback((sessionId: string, audioBase64: string) => {
        send(`/app/exam/${sessionId}/audio`, { audio: audioBase64 })
    }, [send])

    const sendEvent = useCallback((sessionId: string, type: string) => {
        send(`/app/exam/${sessionId}/event`, { type, timestamp: Date.now() })
    }, [send])

    const sendHeartbeat = useCallback((sessionId: string) => {
        send(`/app/exam/${sessionId}/heartbeat`, {})
    }, [send])

    useEffect(() => {
        const token = localStorage.getItem('accessToken')
        if (!token) return

        const client = new Client({
            webSocketFactory: () => new SockJS('/ws'),
            connectHeaders: { Authorization: `Bearer ${token}` },
            reconnectDelay: 5000,
            onConnect: () => {
                connectedRef.current = true

                // Subscribe to session-specific channels
                if (options.sessionId) {
                    client.subscribe(`/queue/exam/${options.sessionId}/warning`, (msg) => {
                        try {
                            const data = JSON.parse(msg.body)
                            options.onWarning?.(data.message || msg.body)
                        } catch { options.onWarning?.(msg.body) }
                    })
                    client.subscribe(`/queue/exam/${options.sessionId}/suspend`, (msg) => {
                        try {
                            const data = JSON.parse(msg.body)
                            options.onSuspend?.(data.reason || msg.body)
                        } catch { options.onSuspend?.(msg.body) }
                    })
                    client.subscribe(`/topic/proctor/session/${options.sessionId}`, (msg) => {
                        try { options.onSessionUpdate?.(JSON.parse(msg.body)) } catch { }
                    })
                }

                // Subscribe to exam-level alert channel (for proctors)
                if (options.examId) {
                    client.subscribe(`/topic/proctor/exam/${options.examId}/alerts`, (msg) => {
                        try { options.onExamAlert?.(JSON.parse(msg.body)) } catch { }
                    })
                }

                // Admin alerts
                if (options.onAdminAlert) {
                    client.subscribe('/topic/admin/alerts', (msg) => {
                        try { options.onAdminAlert?.(JSON.parse(msg.body)) } catch { }
                    })
                }
            },
            onDisconnect: () => { connectedRef.current = false },
            onStompError: (frame) => console.error('STOMP error', frame),
        })

        client.activate()
        clientRef.current = client

        return () => {
            client.deactivate()
            connectedRef.current = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.sessionId, options.examId])

    return { sendFrame, sendAudio, sendEvent, sendHeartbeat, isConnected: () => connectedRef.current }
}
