package com.gestionParking.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = VehiclePhotoUrlsValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidVehiclePhotoUrls {

	String message() default "Les photos doivent etre des URLs HTTPS uniques (max 4, longueur max 2048).";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};
}
