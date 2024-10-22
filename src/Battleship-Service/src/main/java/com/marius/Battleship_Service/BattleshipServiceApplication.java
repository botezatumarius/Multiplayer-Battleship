package com.marius.Battleship_Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@SpringBootApplication
@ComponentScan(basePackages = "com.marius.Battleship_Service")
public class BattleshipServiceApplication {

	private final String serviceName = "battleship";
	private final String serviceDiscoveryUrl = "http://service-discovery:4000/register"; // Update to the service name

	@Autowired
	private Environment environment;

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
		// Get the port assigned to the service instance
		String port = environment.getProperty("local.server.port");
		String serviceAddress = "http://battleship-service:" + port; // Dynamically set the service address

		Map<String, String> requestBody = new HashMap<>();
		requestBody.put("serviceName", serviceName);
		requestBody.put("serviceAddress", serviceAddress);

		try {
			restTemplate.postForEntity(serviceDiscoveryUrl, requestBody, String.class);
			System.out.println(serviceName + " registered successfully at " + serviceAddress);
		} catch (Exception e) {
			System.err.println("Failed to register " + serviceName + ": " + e.getMessage());
		}
	}
}
