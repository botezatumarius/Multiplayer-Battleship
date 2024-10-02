package com.marius.Profile_Service.controllers;

import com.marius.Profile_Service.models.User;
import com.marius.Profile_Service.services.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@RequestBody Map<String, String> request) {
        try {
            String message = authService.registerUser(request.get("username"), request.get("password"));
            return ResponseEntity.ok(Map.of("message", message));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody Map<String, String> request) {
        try {
            String token = authService.loginUser(request.get("username"), request.get("password"));
            return ResponseEntity.ok(Map.of("token", token));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> getProfile(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        User user = authService.getUserFromToken(token).orElseThrow();
        return ResponseEntity.ok(Map.of(
                "user_id", user.getId(),
                "username", user.getUsername(),
                "total_games", user.getTotalGames(),
                "wins", user.getWins(),
                "losses", user.getLosses()));
    }
}
