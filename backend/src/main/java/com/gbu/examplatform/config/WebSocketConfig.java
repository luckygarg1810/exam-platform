package com.gbu.examplatform.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketChannelInterceptor webSocketChannelInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Destinations the server pushes messages to (/topic = broadcast, /queue =
        // unicast)
        config.enableSimpleBroker("/topic", "/queue");
        // Prefix for client-to-server messages handled by @MessageMapping
        config.setApplicationDestinationPrefixes("/app");
        // Prefix for user-specific one-to-one messages (sendToUser)
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("http://localhost:*", "https://*.gbu.ac.in")
                .withSockJS(); // SockJS fallback for browsers without native WebSocket
    }

    /**
     * Register the JWT channel interceptor on the inbound channel.
     * This validates the Bearer token on every STOMP CONNECT frame.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketChannelInterceptor);
    }
}
