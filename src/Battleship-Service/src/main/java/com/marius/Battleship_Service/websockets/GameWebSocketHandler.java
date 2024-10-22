package com.marius.Battleship_Service.websockets;

import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.json.JSONObject;
import org.springframework.stereotype.Component;
import com.marius.Battleship_Service.models.Game;
import com.marius.Battleship_Service.services.GameService;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final GameService gameService;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public GameWebSocketHandler(GameService gameService) {
        this.gameService = gameService;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        // Parse the payload
        Map<String, Object> request = parsePayload(payload);

        if (request == null || !request.containsKey("action")) {
            sendMessage(session, Map.of("error", "Invalid request format or missing action"));
            return;
        }

        String action = (String) request.get("action");
        System.out.println(action);

        switch (action) {
            case "createGame":
                handleCreateGame(session, request);
                break;
            case "joinGame":
                handleJoinGame(session, request);
                break;
            case "attack":
                handleAttack(session, request);
                break;
            case "leaveGame":
                handleLeaveGame(session, request);
                break;
            default:
                sendMessage(session, Map.of("error", "Unknown action"));
        }
    }

    private void handleCreateGame(WebSocketSession session, Map<String, Object> request) {
        String playerId = (String) request.get("player_id");
        Game game = gameService.createGame(playerId);
        sessions.put(playerId, session);

        // Send back game creation confirmation
        sendMessage(session, Map.of(
                "game_id", game.getId(),
                "player_grid", game.getPlayer1Grid(),
                "grid_size", 10,
                "status", game.getStatus()));
    }

    private void handleJoinGame(WebSocketSession session, Map<String, Object> request) {
        String playerId = (String) request.get("player_id");
        String gameId = (String) request.get("game_id");

        Game game = gameService.joinGame(gameId, playerId).orElseThrow();

        sessions.put(playerId, session);

        // Send back join confirmation
        sendMessage(session, Map.of(
                "game_id", game.getId(),
                "player_grid", game.getPlayer2Grid(),
                "grid_size", 10,
                "status", game.getStatus()));
    }

    private void handleAttack(WebSocketSession session, Map<String, Object> request) {
        String gameId = (String) request.get("game_id");
        String attackerId = (String) request.get("attacker_id");
        Map<String, Integer> coordinates = (Map<String, Integer>) request.get("coordinates");

        // Process attack (implement your logic here)
        // gameService.processAttack(gameId, attackerId, coordinates);

        // Notify both players of the result (or broadcast to the game)
        sendMessageToGame(gameId, Map.of("message", "Attack processed", "coordinates", coordinates));
    }

    private void handleLeaveGame(WebSocketSession session, Map<String, Object> request) {
        String playerId = (String) request.get("player_id");
        String gameId = (String) request.get("game_id");

        // gameService.leaveGame(gameId, playerId);
        sessions.remove(playerId);

        // Notify player of the leave confirmation
        sendMessage(session, Map.of("message", "You have left the game.", "status", "player_left"));
    }

    private void sendMessage(WebSocketSession session, Map<String, Object> payload) {
        try {
            String jsonResponse = convertToJson(payload);
            session.sendMessage(new TextMessage(jsonResponse));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void sendMessageToGame(String gameId, Map<String, Object> payload) {
        // Send message to all players in the game
        // For simplicity, assuming both players are in the session map
        // Broadcast message to both players (implement your logic here)
    }

    private Map<String, Object> parsePayload(String payload) {
        try {
            // Create JSONObject from the payload string
            JSONObject jsonObject = new JSONObject(payload);

            // Convert JSONObject to a Map
            Map<String, Object> request = new HashMap<>();
            for (String key : jsonObject.keySet()) {
                request.put(key, jsonObject.get(key));
            }
            return request;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private String convertToJson(Map<String, Object> payload) {
        try {
            // Convert the Map to a JSONObject
            JSONObject jsonObject = new JSONObject(payload);
            return jsonObject.toString(); // Return the JSON string
        } catch (Exception e) {
            e.printStackTrace();
            return "{}"; // Return empty JSON object on error
        }
    }
}
