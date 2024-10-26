package com.marius.Battleship_Service.services;

import com.marius.Battleship_Service.models.Game;
import com.marius.Battleship_Service.repositories.GameRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Random;

@Service
public class GameService {

    @Autowired
    private GameRepository gameRepository;

    public Game createGame(String playerId) {
        Game game = new Game();
        game.setPlayer1Id(playerId);
        game.setStatus("waiting_for_opponent");
        game.setPlayer1Grid(generateGrid()); // Helper method to generate grid with ships
        return gameRepository.save(game);
    }

    public Optional<Game> joinGame(String gameId, String playerId) {
        Optional<Game> game = gameRepository.findById(gameId);
        if (game.isPresent() && game.get().getPlayer2Id() == null) {
            game.get().setPlayer2Id(playerId);
            game.get().setPlayer2Grid(generateGrid()); // Helper method to generate grid with ships
            game.get().setStatus("in_progress");
            return Optional.of(gameRepository.save(game.get()));
        }
        return Optional.empty();
    }

    public Optional<Boolean> isPlayerInGame(String playerId) {
        boolean inGame = gameRepository.findAll().stream()
                .anyMatch(game -> (game.getPlayer1Id() != null && game.getPlayer1Id().equals(playerId)) ||
                        (game.getPlayer2Id() != null && game.getPlayer2Id().equals(playerId)));
        return Optional.of(inGame);
    }

    public String getCurrentGameId(String playerId) {
        return gameRepository.findAll().stream()
                .filter(game -> (game.getPlayer1Id() != null && game.getPlayer1Id().equals(playerId)) ||
                        (game.getPlayer2Id() != null && game.getPlayer2Id().equals(playerId)))
                .map(Game::getId)
                .findFirst()
                .orElse(null); // Returns null if no game is found
    }

    public Optional<Game> leaveGame(String gameId, String playerId) {
        Optional<Game> gameOptional = gameRepository.findById(gameId);
        if (gameOptional.isPresent()) {
            Game game = gameOptional.get();

            if (playerId.equals(game.getPlayer1Id())) {
                game.setStatus("finished");
                game.setPlayer1Id(null);
                game.setPlayer1Grid(null);
                game.setPlayer2Grid(null);

            } else if (playerId.equals(game.getPlayer2Id())) {
                game.setStatus("waiting_for_opponent");
                game.setPlayer2Id(null);
                game.setPlayer2Grid(null);
            }

            gameRepository.save(game);
            return Optional.of(game);
        }
        return Optional.empty();
    }

    public Optional<Game> getGame(String gameId) {
        return gameRepository.findById(gameId);
    }

    private List<Game.Ship> generateGrid() {
        int gridSize = 10;
        List<Game.Ship> ships = new ArrayList<>();
        Random random = new Random();

        // Define the ships and their sizes
        String[] shipNames = { "Carrier", "Battleship", "Cruiser", "Submarine", "Destroyer" };
        int[] shipSizes = { 5, 4, 3, 2, 1 };

        for (int i = 0; i < shipNames.length; i++) {
            boolean placed = false;

            while (!placed) {
                // Random orientation: 0 for horizontal, 1 for vertical
                String orientation = random.nextInt(2) == 0 ? "horizontal" : "vertical";
                int x, y;

                if (orientation.equals("horizontal")) {
                    x = random.nextInt(gridSize - shipSizes[i] + 1); // Ensures the ship fits horizontally
                    y = random.nextInt(gridSize);
                } else {
                    x = random.nextInt(gridSize);
                    y = random.nextInt(gridSize - shipSizes[i] + 1); // Ensures the ship fits vertically
                }

                // Check if the ship can be placed without overlapping
                if (canPlaceShip(x, y, shipSizes[i], orientation, ships)) {
                    // Place the ship
                    for (int j = 0; j < shipSizes[i]; j++) {
                        if (orientation.equals("horizontal")) {
                            ships.add(new Game.Ship(x + j, y, shipNames[i], orientation));
                        } else {
                            ships.add(new Game.Ship(x, y + j, shipNames[i], orientation));
                        }
                    }
                    placed = true;
                }
            }
        }

        return ships;
    }

    // Helper method to check if the ship can be placed without overlapping
    private boolean canPlaceShip(int x, int y, int shipSize, String orientation, List<Game.Ship> ships) {
        for (int i = 0; i < shipSize; i++) {
            int checkX = orientation.equals("horizontal") ? x + i : x;
            int checkY = orientation.equals("vertical") ? y + i : y;

            // Check if any existing ship occupies this position
            for (Game.Ship ship : ships) {
                if (ship.getX() == checkX && ship.getY() == checkY) {
                    return false; // Overlap detected
                }
            }
        }
        return true; // No overlap, can place ship
    }

    public void removeGame(String gameId) {
        if (gameId == null || gameId.isEmpty()) {
            throw new IllegalArgumentException("Game ID must not be null or empty");
        }

        // Optional: Check if the game exists before trying to delete
        if (!gameRepository.existsById(gameId)) {
            throw new IllegalArgumentException("Game not found with ID: " + gameId);
        }

        gameRepository.deleteById(gameId);
    }
}
