/* MIGRASI DATABASE v1 -> v2 (khusus instalasi lama)
   WAJIB backup database lebih dahulu. Jangan jalankan pada server produksi tanpa review.
   Jalankan sekali melalui SSMS setelah backup. Skrip dapat dijalankan ulang untuk skema yang sudah v2.
*/
USE DemoAplikasiDB;
GO
IF OBJECT_ID(N'dbo.DemoRequests',N'U') IS NOT NULL
BEGIN
 /* Ubah status lama sebelum constraint baru diterapkan. */
 IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.DemoRequests') AND name='CK_DemoRequests_Status')
  ALTER TABLE dbo.DemoRequests DROP CONSTRAINT CK_DemoRequests_Status;
 IF COL_LENGTH('dbo.DemoRequests','LecturerReviewNotes') IS NULL
  ALTER TABLE dbo.DemoRequests ADD LecturerReviewNotes NVARCHAR(1500) NULL;
 IF COL_LENGTH('dbo.DemoRequests','LecturerScore') IS NULL
  ALTER TABLE dbo.DemoRequests ADD LecturerScore INT NULL;
 UPDATE dbo.DemoRequests SET Status='REVISION_PIC' WHERE Status='NEEDS_REVISION';
 UPDATE dbo.DemoRequests SET Status='SCHEDULED' WHERE Status='APPROVED';
 /* Indeks dan constraint lama dapat menghalangi ALTER COLUMN. */
 IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.DemoRequests') AND name='IX_DemoRequests_LecturerId')
  DROP INDEX IX_DemoRequests_LecturerId ON dbo.DemoRequests;
 IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.DemoRequests') AND name='IX_DemoRequests_Status_Scheduled')
  DROP INDEX IX_DemoRequests_Status_Scheduled ON dbo.DemoRequests;
 IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.DemoRequests') AND name='IX_Demo_Lecturer')
  DROP INDEX IX_Demo_Lecturer ON dbo.DemoRequests;
 IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.DemoRequests') AND name='IX_Demo_Schedule')
  DROP INDEX IX_Demo_Schedule ON dbo.DemoRequests;
 IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.DemoRequests') AND name='CK_DemoRequests_Duration')
  ALTER TABLE dbo.DemoRequests DROP CONSTRAINT CK_DemoRequests_Duration;
 IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.DemoRequests') AND name='CK_DemoRequests_Score')
  ALTER TABLE dbo.DemoRequests DROP CONSTRAINT CK_DemoRequests_Score;
 IF EXISTS(SELECT 1 FROM sys.default_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.DemoRequests') AND name='DF_DemoRequests_Duration')
  ALTER TABLE dbo.DemoRequests DROP CONSTRAINT DF_DemoRequests_Duration;
 ALTER TABLE dbo.DemoRequests ALTER COLUMN ScheduledAt DATETIMEOFFSET(0) NULL;
 ALTER TABLE dbo.DemoRequests ALTER COLUMN DurationMinutes INT NULL;
 ALTER TABLE dbo.DemoRequests ALTER COLUMN Location NVARCHAR(150) NULL;
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.DemoRequests') AND name='CK_DemoRequests_Duration')
  ALTER TABLE dbo.DemoRequests ADD CONSTRAINT CK_DemoRequests_Duration CHECK(DurationMinutes IS NULL OR DurationMinutes BETWEEN 15 AND 240);
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.DemoRequests') AND name='CK_DemoRequests_Score')
  ALTER TABLE dbo.DemoRequests ADD CONSTRAINT CK_DemoRequests_Score CHECK(LecturerScore IS NULL OR LecturerScore BETWEEN 0 AND 100);
 IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.DemoRequests') AND name='CK_DemoRequests_Status')
  ALTER TABLE dbo.DemoRequests ADD CONSTRAINT CK_DemoRequests_Status CHECK(Status IN (
   'PENDING_PIC','REVISION_PIC','PENDING_DOSEN','REVISION_DOSEN',
   'READY_TO_SCHEDULE','SCHEDULED','DEMO_DONE','SUBMITTED','SUBMISSION_REVISION',
   'COMPLETED','REJECTED','CANCELLED'));
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.DemoRequests') AND name='IX_Demo_Lecturer')
  CREATE INDEX IX_Demo_Lecturer ON dbo.DemoRequests(LecturerId,Status,ScheduledAt);
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.DemoRequests') AND name='IX_Demo_Schedule')
  CREATE INDEX IX_Demo_Schedule ON dbo.DemoRequests(Status,ScheduledAt);
END
GO
IF OBJECT_ID(N'dbo.DemoPeriod',N'U') IS NOT NULL AND COL_LENGTH('dbo.DemoPeriod','RequirementsText') IS NULL
 ALTER TABLE dbo.DemoPeriod ADD RequirementsText NVARCHAR(1500) NULL;
GO
IF OBJECT_ID(N'dbo.DemoNotifications',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.DemoNotifications (
  Id INT IDENTITY PRIMARY KEY,DemoId INT NOT NULL REFERENCES dbo.DemoRequests(Id),
  UserId INT NOT NULL REFERENCES dbo.AppUsers(Id),
  Title NVARCHAR(140) NOT NULL,Message NVARCHAR(600) NOT NULL,
  IsRead BIT NOT NULL DEFAULT(0),
  CreatedAt DATETIMEOFFSET(0) NOT NULL DEFAULT(SYSDATETIMEOFFSET())
 );
 CREATE INDEX IX_Notif_User ON dbo.DemoNotifications(UserId,IsRead,CreatedAt DESC);
END
GO
PRINT 'Database v1 sudah dimigrasi ke SPDA v2. Data jadwal historis tetap disimpan.';
