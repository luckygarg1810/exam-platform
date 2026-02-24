package com.gbu.examplatform.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String PROCTORING_EXCHANGE = "proctoring.exchange";

    // Queues
    public static final String FRAME_ANALYSIS_QUEUE = "frame.analysis";
    public static final String AUDIO_ANALYSIS_QUEUE = "audio.analysis";
    public static final String BEHAVIOR_EVENTS_QUEUE = "behavior.events";
    public static final String PROCTORING_RESULTS_QUEUE = "proctoring.results";

    // Routing keys
    public static final String FRAME_ROUTING_KEY = "frame.analysis";
    public static final String AUDIO_ROUTING_KEY = "audio.analysis";
    public static final String BEHAVIOR_ROUTING_KEY = "behavior.events";
    public static final String RESULT_ROUTING_KEY = "proctoring.results";

    @Bean
    public TopicExchange proctoringExchange() {
        return ExchangeBuilder.topicExchange(PROCTORING_EXCHANGE).durable(true).build();
    }

    @Bean
    public Queue frameAnalysisQueue() {
        return QueueBuilder.durable(FRAME_ANALYSIS_QUEUE).build();
    }

    @Bean
    public Queue audioAnalysisQueue() {
        return QueueBuilder.durable(AUDIO_ANALYSIS_QUEUE).build();
    }

    @Bean
    public Queue behaviorEventsQueue() {
        return QueueBuilder.durable(BEHAVIOR_EVENTS_QUEUE).build();
    }

    @Bean
    public Queue proctoringResultsQueue() {
        return QueueBuilder.durable(PROCTORING_RESULTS_QUEUE).build();
    }

    @Bean
    public Binding frameAnalysisBinding() {
        return BindingBuilder.bind(frameAnalysisQueue()).to(proctoringExchange()).with(FRAME_ROUTING_KEY);
    }

    @Bean
    public Binding audioAnalysisBinding() {
        return BindingBuilder.bind(audioAnalysisQueue()).to(proctoringExchange()).with(AUDIO_ROUTING_KEY);
    }

    @Bean
    public Binding behaviorEventsBinding() {
        return BindingBuilder.bind(behaviorEventsQueue()).to(proctoringExchange()).with(BEHAVIOR_ROUTING_KEY);
    }

    @Bean
    public Binding proctoringResultsBinding() {
        return BindingBuilder.bind(proctoringResultsQueue()).to(proctoringExchange()).with(RESULT_ROUTING_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        // AUTO: Spring auto-acks on successful method return, nacks on exception
        factory.setAcknowledgeMode(AcknowledgeMode.AUTO);
        // Process one message at a time per listener — prevents AI result flooding
        factory.setPrefetchCount(1);
        factory.setDefaultRequeueRejected(false); // don't re-queue on deserialization errors
        return factory;
    }
}
