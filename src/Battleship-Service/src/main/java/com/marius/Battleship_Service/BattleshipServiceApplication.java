package com.marius.Battleship_Service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@SpringBootApplication
public class BattleshipServiceApplication {

	private final String serviceName = "battleship";
	private final String serviceAddress = "http://battleship-service:8081"; // Update to the service name
	private final String serviceDiscoveryUrl = "http://service-discovery:4000/register"; // Update to the service name

	public static void main(String[] args) {
		SpringApplication.run(BattleshipServiceApplication.class, args);
	}

	@Bean
	public RestTemplate restTemplate() {
		return new RestTemplate();
	}

	@Bean
	CommandLineRunner run(RestTemplate restTemplate) {
		return args -> {
			registerService(restTemplate);
		};
	}

	private void registerService(RestTemplate restTemplate) {
		Map<String, String> requestBody = new HashMap<>();
		requestBody.put("serviceName", serviceName);
		requestBody.put("serviceAddress", serviceAddress);

		try {
			restTemplate.postForEntity(serviceDiscoveryUrl, requestBody, String.class);
			System.out.println(serviceName + " registered successfully.");
		} catch (Exception e) {
			System.err.println("Failed to register " + serviceName + ": " + e.getMessage());
		}
	}
}