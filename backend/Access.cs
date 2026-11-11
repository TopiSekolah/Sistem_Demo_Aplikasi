using System.Security.Claims;
using Dapper;
using Microsoft.Data.SqlClient;

internal static class Access
{
    public static int UserId(ClaimsPrincipal p)
        => int.Parse(p.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("ID pengguna tidak tersedia."));

    public static string Role(ClaimsPrincipal p)
        => p.FindFirstValue(ClaimTypes.Role) ?? "";

    public static async Task<bool> IsPeriodOpen(SqlConnection db)
        => await db.ExecuteScalarAsync<int>("""
            SELECT COUNT(1) FROM dbo.DemoPeriod
            WHERE Id=1 AND IsOpen=1 AND SYSDATETIMEOFFSET() BETWEEN StartAt AND EndAt
            """) == 1;

    public static async Task<bool> IsDuplicate(SqlConnection db, int studentId, string title)
        => await db.ExecuteScalarAsync<int>("""
            SELECT COUNT(1) FROM dbo.DemoRequests
            WHERE StudentId=@StudentId AND LOWER(LTRIM(RTRIM(Title)))=LOWER(LTRIM(RTRIM(@Title)))
              AND Status NOT IN ('REJECTED','COMPLETED','CANCELLED')
            """, new { StudentId = studentId, Title = title }) > 0;

    public static async Task<bool> IsLecturer(SqlConnection db, int id)
        => await db.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.AppUsers WHERE Id=@Id AND RoleName='DOSEN' AND IsActive=1",
            new { Id = id }) == 1;

    public static string? Validate(DemoInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Title) || input.Title.Length > 180)
            return "Judul aplikasi wajib diisi (maksimal 180 karakter).";
        if ((input.Description?.Length ?? 0) > 2000)
            return "Deskripsi maksimal 2.000 karakter.";
        if (string.IsNullOrWhiteSpace(input.RequiredDocuments) || input.RequiredDocuments.Length > 1500)
            return "Daftar dokumen yang dibawa wajib diisi (maksimal 1.500 karakter).";
        if (input.LecturerId <= 0) return "Pilih dosen pembimbing.";
        return null;
    }

    public static Task<DemoRow?> LockDemo(SqlConnection db, SqlTransaction tx, int id)
        => db.QuerySingleOrDefaultAsync<DemoRow>("""
            SELECT Id,StudentId,LecturerId,Status,ScheduledAt,DurationMinutes,Location
            FROM dbo.DemoRequests WITH (UPDLOCK,HOLDLOCK) WHERE Id=@Id
            """, new { Id = id }, tx);

    public static async Task<bool> CanSee(SqlConnection db, int demoId, ClaimsPrincipal principal)
    {
        var role = Role(principal);
        if (role == "PIC") return await db.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.DemoRequests WHERE Id=@Id", new { Id = demoId }) > 0;
        var id = UserId(principal);
        if (role == "MAHASISWA") return await db.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.DemoRequests WHERE Id=@DemoId AND StudentId=@Id",
            new { DemoId = demoId, Id = id }) > 0;
        if (role == "DOSEN") return await db.ExecuteScalarAsync<int>("""
            SELECT COUNT(1) FROM dbo.DemoRequests
            WHERE Id=@DemoId AND LecturerId=@Id
              AND Status IN ('PENDING_DOSEN','REVISION_DOSEN','READY_TO_SCHEDULE',
                'SCHEDULED','DEMO_DONE','SUBMITTED','SUBMISSION_REVISION','COMPLETED')
            """, new { DemoId = demoId, Id = id }) > 0;
        return false;
    }

    public static Task<int> Notify(SqlConnection db, SqlTransaction tx, int demoId, int userId, string title, string message)
        => db.ExecuteAsync("""
            INSERT INTO dbo.DemoNotifications(DemoId,UserId,Title,Message)
            VALUES(@DemoId,@UserId,@Title,@Message)
            """, new { DemoId = demoId, UserId = userId, Title = title, Message = message }, tx);

    public static Task<int> NotifyPic(SqlConnection db, SqlTransaction tx, int demoId, string title, string message)
        => db.ExecuteAsync("""
            INSERT INTO dbo.DemoNotifications(DemoId,UserId,Title,Message)
            SELECT @DemoId, Id, @Title, @Message FROM dbo.AppUsers WHERE RoleName='PIC' AND IsActive=1
            """, new { DemoId = demoId, Title = title, Message = message }, tx);

    public static Task<int> History(SqlConnection db, SqlTransaction tx, int demoId, int actorId,
        string action, string? fromStatus, string toStatus, string? notes)
        => db.ExecuteAsync("""
            INSERT INTO dbo.DemoHistory(DemoId,ActorId,ActionName,FromStatus,ToStatus,Notes)
            VALUES(@DemoId,@ActorId,@ActionName,@FromStatus,@ToStatus,@Notes)
            """, new
        {
            DemoId = demoId, ActorId = actorId, ActionName = action,
            FromStatus = fromStatus, ToStatus = toStatus, Notes = notes
        }, tx);

    public static bool ValidHeader(byte[] header, string ext)
    {
        if (ext == ".pdf") return header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46;
        return header[0] == 0x50 && header[1] == 0x4B &&
            ((header[2] == 3 && header[3] == 4) || (header[2] == 5 && header[3] == 6));
    }
}
