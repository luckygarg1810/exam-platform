package com.gbu.examplatform.modules.proctoring;

import lombok.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.UUID;

/**
 * WebSocket STOMP message handlers for proctoring media relay.
 *
 * Client sends to:
 * /app/proctoring/{sessionId}/frame → relayed to RabbitMQ frame.analysis queue
 * /app/proctoring/{sessionId}/audio → relayed to RabbitMQ audio.analysis queue
 * /app/proctoring/{sessionId}/behavior → relayed to RabbitMQ behavior.events
 * queue
 */
@Controller
@RequiredArgsConstructor
public class ProctoringEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(ProctoringEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    @MessageMapping("/proctoring/{sessionId}/frame")
    public void handleFrame(@DestinationVariable String sessionId,
            @Payload Map<String, Object> frameData) {
        frameData.put("sessionId", sessionId);
        rabbitTemplate.convertAndSend("proctoring.exchange", "frame.analysis", frameData);
        log.debug("Relayed frame to RabbitMQ for session {}", sessionId);
    }

    @MessageMapping("/proctoring/{sessionId}/audio")
    public void handleAudio(@DestinationVariable String sessionId,
            @Payload Map<String, Object> audioData) {
        audioData.put("sessionId", sessionId);
        rabbitTemplate.convertAndSend("proctoring.exchange", "audio.analysis", audioData);
        log.debug("Relayed audio to RabbitMQ for session {}", sessionId);
    }

    @MessageMapping("/proctoring/{sessionId}/behavior")
    public void handleBehavior(@DestinationVariable String sessionId,
            @Payload Map<String, Object> behaviorData) {
        behaviorData.put("sessionId", sessionId);
        rabbitTemplate.convertAndSend("proctoring.exchange", "behavior.events", behaviorData);
        log.debug("Relayed behavior event to RabbitMQ for session {}", sessionId);
    }
}
