using System.ComponentModel.DataAnnotations;
public record PeriodInput(bool IsOpen, DateTimeOffset StartAt, DateTimeOffset EndAt, string? RequirementsText);
public record LoginInput([Required] string Username, [Required] string Password);
public record DemoInput([Required] string Title, string? Description, int LecturerId, [Required] string RequiredDocuments);
public record ReviewInput([Required] string Decision, string? Notes);
public record ScheduleInput(DateTimeOffset ScheduledAt, int DurationMinutes, [Required] string Location);
public record EvaluationInput(int Score, [Required] string Notes);
public record CompleteDemoInput(string? Notes);
public record SubmissionReviewInput([Required] string Decision, string? Notes);
public record UserCreateInput([Required] string Username, [Required] string FullName, [Required] string Password, [Required] string RoleName, string? Email);
public record UserUpdateInput([Required] string FullName, string? Email, bool IsActive, string? NewPassword);
public record ReassignLecturerInput(int LecturerId, string? Notes);
public sealed class UserRow
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string FullName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string RoleName { get; set; } = "";
    public bool IsActive { get; set; }
}
public sealed class DemoRow
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int LecturerId { get; set; }
    public string Status { get; set; } = "";
    public DateTimeOffset? ScheduledAt { get; set; }
    public int? DurationMinutes { get; set; }
    public string? Location { get; set; }
}
public sealed class FileRow
{
    public int Id { get; set; }
    public int DemoId { get; set; }
    public string OriginalName { get; set; } = "";
    public string StoredName { get; set; } = "";
    public string ContentType { get; set; } = "";
}
