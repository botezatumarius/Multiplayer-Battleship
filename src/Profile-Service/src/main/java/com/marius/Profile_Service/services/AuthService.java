package com.marius.Profile_Service.services;

import com.marius.Profile_Service.models.User;
import com.marius.Profile_Service.repositories.UserRepository;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.spec.SecretKeySpec;
import java.security.Key;
import java.util.*;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    private BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private final Key signingKey = Keys.secretKeyFor(SignatureAlgorithm.HS256);
    private final Map<String, User> rollbackLog = new HashMap<>();

    public String registerUser(String username, String password) {
        Optional<User> existingUser = userRepository.findByUsername(username);
        if (existingUser.isPresent()) {
            throw new IllegalArgumentException("Username already taken.");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        userRepository.save(user);
        return "User registered successfully";
    }

    public String loginUser(String username, String password) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty() || !passwordEncoder.matches(password, userOpt.get().getPassword())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        return generateToken(userOpt.get());
    }

    private String generateToken(User user) {
        return Jwts.builder()
                .setSubject(user.getUsername())
                .claim("user_id", user.getId())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 86400000)) // 1 day expiration
                .signWith(signingKey)
                .compact();
    }

    public Optional<User> getUserFromToken(String token) {
        String username = Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();

        return userRepository.findByUsername(username);
    }

    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public void logRollbackState(String transactionId, User user) {
        User clonedUser = new User();
        clonedUser.setId(user.getId());
        clonedUser.setUsername(user.getUsername());
        clonedUser.setPassword(user.getPassword());
        clonedUser.setTotalGames(user.getTotalGames());
        clonedUser.setWins(user.getWins());
        clonedUser.setLosses(user.getLosses());

        rollbackLog.put(transactionId, clonedUser);
    }

    public boolean rollbackUserStats(String transactionId) {
        if (rollbackLog.containsKey(transactionId)) {
            User originalState = rollbackLog.get(transactionId);
            userRepository.save(originalState);
            rollbackLog.remove(transactionId);
            return true;
        }
        return false;
    }

    public String updateUserStats(String username, String result) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            throw new IllegalArgumentException("User not found.");
        }

        User user = userOpt.get();

        if ("win".equals(result)) {
            user.setWins(user.getWins() + 1);
        } else if ("loss".equals(result)) {
            user.setLosses(user.getLosses() + 1);
        } else {
            throw new IllegalArgumentException("Invalid result type.");
        }

        user.setTotalGames(user.getTotalGames() + 1);
        userRepository.save(user);
        return "User stats updated successfully";
    }
}
