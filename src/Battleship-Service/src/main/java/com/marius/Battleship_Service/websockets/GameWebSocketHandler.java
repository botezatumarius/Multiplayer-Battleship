package com.marius.Battleship_Service.websockets;

import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.apache.el.stream.Optional;
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

        // Check if the player is already in a game
        if (gameService.isPlayerInGame(playerId).orElse(false)) {
            // Get the current game ID if they are in one
            String currentGameId = gameService.getCurrentGameId(playerId);
            sendMessage(session, Map.of("error",
                    "You are already in a game (Game ID: " + currentGameId
                            + "). Please leave the game before creating a new one."));
            return;
        }

        // Proceed to create the game
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

        // Check if the player is already in a game
        if (gameService.isPlayerInGame(playerId).orElse(false)) {
            // Get the current game ID if they are in one
            String currentGameId = gameService.getCurrentGameId(playerId);
            sendMessage(session, Map.of("error",
                    "You are already in a game (Game ID: " + currentGameId
                            + "). Please leave the game before joining another one."));
            return;
        }

        // Fetch the game and check if it exists and is waiting for an opponent
        java.util.Optional<Game> gameOpt = gameService.getGame(gameId);
        if (gameOpt.isEmpty()) {
            sendMessage(session, Map.of("error", "Game not found"));
            return;
        }

        Game game = gameOpt.get();
        if (!"waiting_for_opponent".equals(game.getStatus())) {
            sendMessage(session, Map.of("error", "Game is not available for joining"));
            return;
        }

        // Proceed with joining the game if it is valid
        java.util.Optional<Game> joinedGameOpt = gameService.joinGame(gameId, playerId);
        if (joinedGameOpt.isEmpty()) {
            sendMessage(session, Map.of("error", "Unable to join game"));
            return;
        }

        Game joinedGame = joinedGameOpt.get();
        sessions.put(playerId, session);

        // Send back join confirmation to the player who joined
        sendMessage(session, Map.of(
                "game_id", joinedGame.getId(),
                "player_grid", joinedGame.getPlayer2Grid(),
                "grid_size", 10,
                "status", joinedGame.getStatus()));

        // Notify the game creator (player1) that another player has joined
        String creatorId = joinedGame.getPlayer1Id();
        WebSocketSession creatorSession = sessions.get(creatorId);

        if (creatorSession != null && creatorSession.isOpen()) {
            sendMessage(creatorSession, Map.of(
                    "message", "A player has joined your game",
                    "game_id", joinedGame.getId(),
                    "status", "player_joined"));
        }
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

        // Attempt to leave the game, which should update the database
        Game game = gameService.leaveGame(gameId, playerId)
                .orElseThrow(() -> new IllegalArgumentException("Game not found or you are not part of it."));
        sessions.remove(playerId);

        // Notify the player who left the game
        sendMessage(session, Map.of("message", "You have left the game.", "status", "player_left"));

        // Check if the player leaving is player1 (the creator)
        if (playerId.equals(game.getPlayer1Id())) {
            // Notify player2 that the game has ended because the creator left
            String player2Id = game.getPlayer2Id();
            WebSocketSession player2Session = sessions.get(player2Id);

            if (player2Session != null && player2Session.isOpen()) {
                sendMessage(player2Session, Map.of(
                        "message", "The creator has left the game. The game has ended.",
                        "game_id", game.getId(),
                        "status", "game_ended"));
            }
            // Optionally: Remove the game from the database if the creator leaves
            gameService.removeGame(gameId); // Ensure this method is implemented to handle removal

        } else if (playerId.equals(game.getPlayer2Id())) {
            // Notify the creator that the opponent has left
            String creatorId = game.getPlayer1Id();
            WebSocketSession creatorSession = sessions.get(creatorId);

            if (creatorSession != null && creatorSession.isOpen()) {
                sendMessage(creatorSession, Map.of(
                        "message", "The opponent has left your game.",
                        "game_id", game.getId(),
                        "status", "opponent_left"));
            }
        }
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
