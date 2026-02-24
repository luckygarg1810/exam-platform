package com.gbu.examplatform.scheduler;

import com.gbu.examplatform.modules.storage.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;

/**
 * Periodic cleanup of old MinIO objects.
 *
 * Runs during off-peak hours to delete:
 * - violation-snapshots older than 30 days (daily at 02:00)
 * - audio-clips older than 30 days (daily at 03:00)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CleanupScheduler {

    private final StorageService storageService;

    @Value("${minio.buckets.violation-snapshots:violation-snapshots}")
    private String snapshotBucket;

    @Value("${minio.buckets.audio-clips:audio-clips}")
    private String audioClipBucket;

    private static final int RETENTION_DAYS = 30;

    /** Daily at 02:00 — delete violation snapshots older than RETENTION_DAYS */
    @Scheduled(cron = "0 0 2 * * *")
    public void cleanupViolationSnapshots() {
        log.info("Starting cleanup of violation snapshots older than {} days", RETENTION_DAYS);
        int deleted = deleteOldObjects(snapshotBucket, RETENTION_DAYS);
        log.info("Violation snapshots cleanup complete: {} object(s) deleted", deleted);
    }

    /** Daily at 03:00 — delete audio clips older than RETENTION_DAYS */
    @Scheduled(cron = "0 0 3 * * *")
    public void cleanupAudioClips() {
        log.info("Starting cleanup of audio clips older than {} days", RETENTION_DAYS);
        int deleted = deleteOldObjects(audioClipBucket, RETENTION_DAYS);
        log.info("Audio clips cleanup complete: {} object(s) deleted", deleted);
    }

    private int deleteOldObjects(String bucket, int olderThanDays) {
        ZonedDateTime cutoff = ZonedDateTime.now().minusDays(olderThanDays);
        int count = 0;

        for (String key : storageService.listObjectKeysOlderThan(bucket, cutoff)) {
            try {
                storageService.deleteFile(bucket, key);
                count++;
                log.debug("Deleted old object: {}/{}", bucket, key);
            } catch (Exception e) {
                log.warn("Failed to delete object {}/{}: {}", bucket, key, e.getMessage());
            }
        }

        return count;
    }
}
