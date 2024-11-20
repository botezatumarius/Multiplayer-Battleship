package com.marius.Profile_Service.controllers;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;

import com.marius.Profile_Service.models.User;
import com.marius.Profile_Service.services.AuthService;

import org.springframework.beans.factory.annotation.Autowired;
import java.util.Map;
import java.util.Optional;

@RestController
public class ProfileController {

    @Autowired
    private AuthService authService;

    @GetMapping("/status")
    public String status() {
        return "200 OK";
    }

    @PostMapping("/update-stats")
    public ResponseEntity<Map<String, String>> updateStats(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String result = request.get("result");
            String responseMessage = authService.updateUserStats(username, result);
            return ResponseEntity.ok(Map.of("message", responseMessage));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 2PC Prepare Phase
    @PostMapping("/prepare")
    public ResponseEntity<Map<String, String>> prepare(@RequestBody Map<String, String> request) {
        String transactionId = request.get("transactionId");
        String username = request.get("username");
        String result = request.get("result");

        if (transactionId == null || username == null || result == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Missing required fields"));
        }

        Optional<User> user = authService.getUserByUsername(username);
        if (user.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "fail", "reason", "User not found"));
        }

        authService.logRollbackState(transactionId, user.get());
        return ResponseEntity.ok(Map.of("status", "ready"));
    }

    // 2PC Commit Phase
    @PostMapping("/commit")
    public ResponseEntity<Map<String, String>> commit(@RequestBody Map<String, String> request) {
        String transactionId = request.get("transactionId");
        String username = request.get("username");
        String result = request.get("result");

        if (transactionId == null || username == null || result == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Missing required fields"));
        }

        try {
            authService.updateUserStats(username, result);
            return ResponseEntity.ok(Map.of("status", "committed"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", e.getMessage()));
        }
    }

    // 2PC Rollback Phase
    @PostMapping("/rollback")
    public ResponseEntity<Map<String, String>> rollback(@RequestBody Map<String, String> request) {
        String transactionId = request.get("transactionId");

        if (transactionId == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Missing required fields"));
        }

        boolean success = authService.rollbackUserStats(transactionId);
        if (success) {
            return ResponseEntity.ok(Map.of("status", "rolled back"));
        } else {
            return ResponseEntity.badRequest().body(Map.of("status", "fail", "reason", "Rollback failed"));
        }
    }
}
