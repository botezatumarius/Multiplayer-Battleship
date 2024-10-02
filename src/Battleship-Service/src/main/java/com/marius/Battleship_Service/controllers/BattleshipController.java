package com.marius.Battleship_Service.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "*")
public class BattleshipController {

    @GetMapping("/status")
    public String status() {
        return "200 OK";
    }
}
