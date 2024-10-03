package com.marius.Profile_Service.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RestController;

import com.marius.Profile_Service.models.User;
import com.marius.Profile_Service.services.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.Map;

@RestController
// @CrossOrigin(origins = "*")
public class ProfileController {

    @Autowired
    private AuthService authService;

    @GetMapping("/status")
    public String status() {
        return "200 OK";
    }

    @PostMapping("/update-stats")
    public ResponseEntity<Map<String, String>> updateStats(@RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> request) {
        try {
            String token = authHeader.replace("Bearer ", "");
            User user = authService.getUserFromToken(token).orElseThrow();

            String result = authService.updateUserStats(user, request.get("result"));
            return ResponseEntity.ok(Map.of("message", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

}