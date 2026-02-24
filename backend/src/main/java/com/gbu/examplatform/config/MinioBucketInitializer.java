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
    }
}