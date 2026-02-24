package com.gbu.examplatform.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Slf4j
@Configuration
public class MinioConfig {

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Value("${minio.buckets.profile-photos}")
    private String profilePhotosBucket;

    @Value("${minio.buckets.violation-snapshots}")
    private String violationSnapshotsBucket;

    @Value("${minio.buckets.audio-clips}")
    private String audioClipsBucket;

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }

    @PostConstruct
    public void initBuckets() {
        MinioClient client = minioClient();
        List<String> buckets = List.of(profilePhotosBucket, violationSnapshotsBucket, audioClipsBucket);
        for (String bucket : buckets) {
            try {
                boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
                if (!exists) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    log.info("Created MinIO bucket: {}", bucket);
                }
            } catch (Exception e) {
                log.warn("Could not initialize MinIO bucket '{}': {}", bucket, e.getMessage());
            }
        }
    }
}
