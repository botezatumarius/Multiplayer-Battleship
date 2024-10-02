package com.marius.Profile_Service.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RestController;

@RestController
// @CrossOrigin(origins = "*")
public class ProfileController {

    @GetMapping("/status")
    public String status() {
        return "200 OK";
    }
}