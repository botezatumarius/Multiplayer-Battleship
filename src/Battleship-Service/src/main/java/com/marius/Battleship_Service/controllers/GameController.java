package com.marius.Battleship_Service.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.marius.Battleship_Service.models.Game;
import com.marius.Battleship_Service.services.GameService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/game")
public class GameController {

    @Autowired
    private GameService gameService;

    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> createGame(@RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> request) {
        String token = authHeader.replace("Bearer ", "");
        String playerId = request.get("player_id");

        // Verify token and extract user ID logic (omitted)

        Game game = gameService.createGame(playerId);

        return ResponseEntity.ok(Map.of(
                "game_id", game.getId(),
                "player_grid", game.getPlayer1Grid(),
                "grid_size", 10,
                "status", game.getStatus()));
    }

    @PostMapping("/join")
    public ResponseEntity<Map<String, Object>> joinGame(@RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> request) {
        String token = authHeader.replace("Bearer ", "");
        String playerId = request.get("player_id");
        String gameId = request.get("game_id");

        // Verify token logic (omitted)

        Game game = gameService.joinGame(gameId, playerId).orElseThrow();

        return ResponseEntity.ok(Map.of(
                "game_id", game.getId(),
                "player_grid", game.getPlayer2Grid(),
                "grid_size", 10,
                "status", game.getStatus()));
    }

    @PostMapping("/attack")
    public ResponseEntity<String> attack(@RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> request) {
        String token = authHeader.replace("Bearer ", "");
        String gameId = (String) request.get("game_id");
        String attackerId = (String) request.get("attacker_id");
        Map<String, Integer> coordinates = (Map<String, Integer>) request.get("coordinates");

        // Attack logic (omitted)
        return ResponseEntity.ok("Attack processed");
    }

    @PostMapping("/leave")
    public ResponseEntity<Map<String, String>> leaveGame(@RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> request) {
        String token = authHeader.replace("Bearer ", "");
        String gameId = request.get("game_id");
        String playerId = request.get("player_id");

        // Leave game logic (omitted)
        return ResponseEntity.ok(Map.of(
                "message", "You have left the game.",
                "status", "player_left"));
    }
}
