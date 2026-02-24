package com.gbu.examplatform.modules.storage;

import io.minio.*;
import io.minio.http.Method;
import io.minio.messages.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
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

    /**
     * Returns object keys in the given bucket whose last-modified timestamp is
     * strictly before {@code cutoff}. Encapsulates the MinIO listing API so callers
     * have no reason to import the MinIO SDK directly (Issue 20).
     */
    public List<String> listObjectKeysOlderThan(String bucket, ZonedDateTime cutoff) {
        List<String> keys = new ArrayList<>();
        try {
            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder().bucket(bucket).recursive(true).build());
            for (Result<Item> result : results) {
                try {
                    Item item = result.get();
                    if (item.lastModified() != null && item.lastModified().isBefore(cutoff)) {
                        keys.add(item.objectName());
                    }
                } catch (Exception e) {
                    log.warn("Failed to read object metadata in bucket {}: {}", bucket, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error listing objects in bucket {}: {}", bucket, e.getMessage());
        }
        return keys;
    }
}
