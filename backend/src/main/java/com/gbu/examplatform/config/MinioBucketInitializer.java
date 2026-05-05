package com.gbu.examplatform.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class MinioBucketInitializer {

    private final MinioClient minioClient;

    @Value("${minio.buckets.profile-photos}")
    private String profilePhotosBucket;

    @Value("${minio.buckets.violation-snapshots}")
    private String violationSnapshotsBucket;

    @Value("${minio.buckets.audio-clips}")
    private String audioClipsBucket;

    @PostConstruct
    public void initBuckets() {
        List<String> buckets = List.of(
                profilePhotosBucket,
                violationSnapshotsBucket,
                audioClipsBucket);

        for (String bucket : buckets) {
            try {
                boolean exists = minioClient.bucketExists(
                        BucketExistsArgs.builder().bucket(bucket).build());

                if (!exists) {
                    minioClient.makeBucket(
                            MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Created MinIO bucket: {}", bucket);
                }
            } catch (Exception e) {
                log.warn("Could not initialize MinIO bucket '{}': {}", bucket, e.getMessage());
            }
        }

        // Set public-read (anonymous download) policy on profile-photos so the
        // browser can load unsigned URLs directly (StorageService.getPresignedUrl
        // returns a plain URL, not a presigned one).
        applyPublicReadPolicy(profilePhotosBucket);
    }

    /**
     * Applies an S3-compatible public-read bucket policy that allows anonymous
     * GET/HEAD on all objects. MinIO enforces this via its policy API.
     */
    private void applyPublicReadPolicy(String bucket) {
        String policy = """
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {"AWS": ["*"]},
                      "Action": ["s3:GetObject"],
                      "Resource": ["arn:aws:s3:::%s/*"]
                    }
                  ]
                }
                """.formatted(bucket);
        try {
            minioClient.setBucketPolicy(
                    io.minio.SetBucketPolicyArgs.builder()
                            .bucket(bucket)
                            .config(policy)
                            .build());
            log.info("Applied public-read policy to MinIO bucket: {}", bucket);
        } catch (Exception e) {
            log.error("Failed to set public-read policy on bucket '{}': {}", bucket, e.getMessage(), e);
        }
    }
}