package com.marius.Battleship_Service.repositories;

import com.marius.Battleship_Service.models.Game;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface GameRepository extends MongoRepository<Game, String> {
    Optional<Game> findByPlayer1IdOrPlayer2Id(String player1Id, String player2Id);
}
