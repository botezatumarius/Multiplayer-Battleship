package com.marius.Battleship_Service.models;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;

@Document(collection = "games")
public class Game {

    @Id
    private String id;
    private String player1Id;
    private String player2Id;
    private List<Ship> player1Grid;
    private List<Ship> player2Grid;
    private String status; // waiting_for_opponent, in_progress, finished

    // Getters and Setters for Game class
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPlayer1Id() {
        return player1Id;
    }

    public void setPlayer1Id(String player1Id) {
        this.player1Id = player1Id;
    }

    public String getPlayer2Id() {
        return player2Id;
    }

    public void setPlayer2Id(String player2Id) {
        this.player2Id = player2Id;
    }

    public List<Ship> getPlayer1Grid() {
        return player1Grid;
    }

    public void setPlayer1Grid(List<Ship> player1Grid) {
        this.player1Grid = player1Grid;
    }

    public List<Ship> getPlayer2Grid() {
        return player2Grid;
    }

    public void setPlayer2Grid(List<Ship> player2Grid) {
        this.player2Grid = player2Grid;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    // Nested class for ship
    public static class Ship {
        private int x;
        private int y;
        private String ship;
        private String orientation;

        // Constructor
        public Ship(int x, int y, String ship, String orientation) {
            this.x = x;
            this.y = y;
            this.ship = ship;
            this.orientation = orientation;
        }

        // Getters and Setters for Ship class
        public int getX() {
            return x;
        }

        public void setX(int x) {
            this.x = x;
        }

        public int getY() {
            return y;
        }

        public void setY(int y) {
            this.y = y;
        }

        public String getShip() {
            return ship;
        }

        public void setShip(String ship) {
            this.ship = ship;
        }

        public String getOrientation() {
            return orientation;
        }

        public void setOrientation(String orientation) {
            this.orientation = orientation;
        }
    }
}
