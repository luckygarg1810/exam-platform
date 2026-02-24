package com.gbu.examplatform.exception;

public class SessionAlreadyActiveException extends RuntimeException {
    public SessionAlreadyActiveException(String message) {
        super(message);
    }
}
