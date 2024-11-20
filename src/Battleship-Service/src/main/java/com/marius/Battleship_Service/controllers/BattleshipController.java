package com.marius.Battleship_Service.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RestController;

import com.marius.Battleship_Service.services.GameService;

@RestController
public class BattleshipController {

    @Autowired
    private GameService gameService;

    @GetMapping("/status")
    public String status() {
        return "200 OK";
    }

    @PostMapping("/prepare")
    public ResponseEntity<Map<String, String>> prepare(@RequestBody Map<String, String> request) {
        String transactionId = request.get("transactionId");
        String gameId = request.get("gameId");
        String username = request.get("username");

        // Validate input
        if (transactionId == null || gameId == null || username == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Missing required fields"));
        }

        // Validate game for transaction
        boolean isValid = gameService.validateGameForTransaction(gameId, username);
        if (!isValid) {
            return ResponseEntity.ok(Map.of("status", "fail", "reason", "Game validation failed"));
        }

        return ResponseEntity.ok(Map.of("status", "ready"));
    }

    @PostMapping("/commit")
    public ResponseEntity<Map<String, String>> commit(@RequestBody Map<String, String> request) {
        String transactionId = request.get("transactionId");
        String gameId = request.get("gameId");

        if (transactionId == null || gameId == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Missing required fields"));
        }

        boolean committed = gameService.commitGame(gameId);
        if (committed) {
            return ResponseEntity.ok(Map.of("status", "committed"));
        }

        return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Commit failed"));
    }

    @PostMapping("/rollback")
    public ResponseEntity<Map<String, String>> rollback(@RequestBody Map<String, String> request) {
        String transactionId = request.get("transactionId");
        String gameId = request.get("gameId");

        if (transactionId == null || gameId == null) {
            System.out.println("Missing fields");
            return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Missing required fields"));
        }

        boolean rolledBack = gameService.rollbackGame(gameId);
        if (rolledBack) {
            return ResponseEntity.ok(Map.of("status", "rolled back"));
        }

        return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Rollback failed"));
    }
}