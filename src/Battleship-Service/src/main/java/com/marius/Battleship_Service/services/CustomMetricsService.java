package com.marius.Battleship_Service.services;

import org.springframework.stereotype.Component;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class CustomMetricsService {

    private final Counter customMetricCounter;
    private final AtomicInteger activeWebSocketConnections;

    public CustomMetricsService(MeterRegistry meterRegistry) {
        // Counter to track certain events
        customMetricCounter = Counter.builder("current_active_socket_connections")
                .description("Number of currently active websocket connections")
                .tags("environment", "development")
                .register(meterRegistry);

        // AtomicInteger to track real-time count of active WebSocket connections
        activeWebSocketConnections = new AtomicInteger(0);

        // Gauge to monitor the value of activeWebSocketConnections
        Gauge.builder("active_websocket_connections", activeWebSocketConnections, AtomicInteger::get)
                .description("Current number of active WebSocket connections")
                .tags("environment", "development")
                .register(meterRegistry);
    }

    // Increment counter method
    public void incrementCustomMetric() {
        customMetricCounter.increment();
    }

    // Methods to increment and decrement active WebSocket connections
    public void incrementActiveWebSocketConnections() {
        activeWebSocketConnections.incrementAndGet();
    }

    public void decrementActiveWebSocketConnections() {
        activeWebSocketConnections.decrementAndGet();
    }
}
