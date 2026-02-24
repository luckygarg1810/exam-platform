package com.gbu.examplatform.modules.storage;

import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class StorageService {

    private final MinioClient minioClient;

    public void uploadFile(String bucket, String objectKey, InputStream inputStream,
            long size, String contentType) {
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(inputStream, size, -1)
                    .contentType(contentType)
                    .build());
            log.debug("Uploaded file to MinIO: {}/{}", bucket, objectKey);
        } catch (Exception e) {
            log.error("Failed to upload to MinIO: {}/{} — {}", bucket, objectKey, e.getMessage(), e);
            throw new RuntimeException("File upload failed: " + e.getMessage(), e);
        }
    }

    public void uploadBytes(String bucket, String objectKey, byte[] data, String contentType) {
        try (var inputStream = new java.io.ByteArrayInputStream(data)) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(inputStream, data.length, -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            throw new RuntimeException("File upload failed: " + e.getMessage(), e);
        }
    }

    public String getPresignedUrl(String bucket, String objectKey, int expiryMinutes) {
        try {
            return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(bucket)
                    .object(objectKey)
                    .expiry(expiryMinutes, TimeUnit.MINUTES)
                    .build());
        } catch (Exception e) {
            log.error("Failed to generate presigned URL: {}", e.getMessage());
            return null;
        }
    }

    public InputStream downloadFile(String bucket, String objectKey) {
        try {
            return minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            throw new RuntimeException("File download failed: " + e.getMessage(), e);
        }
    }

    public void deleteFile(String bucket, String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
            log.debug("Deleted file from MinIO: {}/{}", bucket, objectKey);
        } catch (Exception e) {
            log.warn("Failed to delete MinIO object {}/{}: {}", bucket, objectKey, e.getMessage());
        }
    }
}
