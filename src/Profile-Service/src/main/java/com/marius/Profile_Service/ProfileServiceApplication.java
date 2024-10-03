package com.marius.Profile_Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@SpringBootApplication(exclude = { SecurityAutoConfiguration.class })
public class ProfileServiceApplication {

	private final String serviceName = "profile";
	private final String serviceAddress = "http://localhost:8082";
	private final String serviceDiscoveryUrl = "http://localhost:4000/register";

	public static void main(String[] args) {
		SpringApplication.run(ProfileServiceApplication.class, args);
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
