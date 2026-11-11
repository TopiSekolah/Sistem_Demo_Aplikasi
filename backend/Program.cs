using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
var signingKey = Environment.GetEnvironmentVariable("JWT_SIGNING_KEY") ?? builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(signingKey) || Encoding.UTF8.GetByteCount(signingKey) < 32)
    throw new InvalidOperationException("Set JWT_SIGNING_KEY minimal 32 byte (atau Jwt:Key di appsettings.Development.json untuk lokal).");

builder.Services.AddTransient(_ => new SqlConnection(
    builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection belum diatur.")));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1)
    };

    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var idText = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(idText,out var id)) { context.Fail("Identitas token tidak valid."); return; }
            var db = context.HttpContext.RequestServices.GetRequiredService<SqlConnection>();
            await db.OpenAsync();
            var active = await db.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM dbo.AppUsers WHERE Id=@Id AND IsActive=1",new { Id=id });
            if(active!=1) context.Fail("Akun sudah tidak aktif.");
        }
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Mahasiswa", p => p.RequireRole("MAHASISWA"));
    options.AddPolicy("Dosen", p => p.RequireRole("DOSEN"));
    options.AddPolicy("Pic", p => p.RequireRole("PIC"));
});
builder.Services.AddCors(options => options.AddPolicy("NextJs", p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:3000"])
    .AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Demo Scheduling API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT",
        Description = "JWT token dari POST /api/auth/login"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() }
    });
});
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 35L * 1024 * 1024);

var app = builder.Build();
app.UseCors("NextJs");
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", application = "Demo Scheduling API" }));
app.MapPost("/api/auth/login", async Task<IResult> (LoginInput input, SqlConnection db, IConfiguration config) =>
{
    if (string.IsNullOrWhiteSpace(input.Username) || string.IsNullOrWhiteSpace(input.Password))
        return Results.BadRequest(new { message = "Username dan password wajib diisi." });
    await db.OpenAsync();
    var user = await db.QuerySingleOrDefaultAsync<UserRow>(
        "SELECT Id,Username,FullName,PasswordHash,RoleName,IsActive FROM dbo.AppUsers WHERE Username=@Username",
        new { Username = input.Username?.Trim() ?? "" });
    if (user is null || !user.IsActive ||
        new PasswordHasher<UserRow>().VerifyHashedPassword(user, user.PasswordHash, input.Password)
            == PasswordVerificationResult.Failed)
        return Results.Json(new { message = "Username atau password salah." }, statusCode: 401);

    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.FullName),
        new Claim(ClaimTypes.Role, user.RoleName),
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
    };
    var expires = DateTime.UtcNow.AddHours(8);
    var token = new JwtSecurityToken(
        issuer: config["Jwt:Issuer"], audience: config["Jwt:Audience"], claims: claims,
        expires: expires, signingCredentials: new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256));
    return Results.Ok(new
    {
        token = new JwtSecurityTokenHandler().WriteToken(token),
        expiresAt = expires,
        user = new { id = user.Id, username = user.Username, fullName = user.FullName, role = user.RoleName }
    });
});

var auth = app.MapGroup("/api").RequireAuthorization();
auth.MapGet("/auth/me", async Task<IResult> (ClaimsPrincipal principal, SqlConnection db) =>
{
    await db.OpenAsync();
    var account = await db.QuerySingleOrDefaultAsync(
        "SELECT Id AS id,Username AS username,FullName AS fullName,RoleName AS role FROM dbo.AppUsers WHERE Id=@Id AND IsActive=1",
        new { Id = Access.UserId(principal) });
    return account is null ? Results.Unauthorized() : Results.Ok(account);
});
auth.MapGet("/users/lecturers", async (SqlConnection db) =>
{
    await db.OpenAsync();
    return Results.Ok(await db.QueryAsync(
        "SELECT Id AS id,FullName AS fullName FROM dbo.AppUsers WHERE RoleName='DOSEN' AND IsActive=1 ORDER BY FullName"));
});

auth.MapGet("/users", async Task<IResult> (SqlConnection db) =>
{
    await db.OpenAsync();
    return Results.Ok(await db.QueryAsync("""
        SELECT Id AS id, Username AS username, FullName AS fullName,
               Email AS email,RoleName AS role,IsActive AS isActive
        FROM dbo.AppUsers ORDER BY RoleName,FullName
        """));
}).RequireAuthorization("Pic");
auth.MapPost("/users", async Task<IResult> (UserCreateInput input, SqlConnection db) =>
{
    var role = input.RoleName?.Trim().ToUpperInvariant();
    if (role is not ("MAHASISWA" or "DOSEN" or "PIC") ||
        string.IsNullOrWhiteSpace(input.Username) || input.Username.Length > 80 ||
        string.IsNullOrWhiteSpace(input.FullName) || input.FullName.Length > 150 ||
        string.IsNullOrWhiteSpace(input.Password) || input.Password.Length < 8 || input.Password.Length > 128 ||
        input.Email?.Length > 180)
        return Results.BadRequest(new { message = "Data pengguna tidak valid. Password minimal 8 karakter." });
    await db.OpenAsync();
    if (await db.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM dbo.AppUsers WHERE Username=@Username", new { Username = input.Username.Trim() }) > 0)
        return Results.Conflict(new { message = "Username sudah digunakan." });
    var hash = new PasswordHasher<UserRow>().HashPassword(new UserRow(), input.Password);
    var id = await db.QuerySingleAsync<int>("""
        INSERT dbo.AppUsers(Username,FullName,PasswordHash,RoleName,Email)
        OUTPUT INSERTED.Id VALUES(@Username,@FullName,@Hash,@Role,@Email)
        """, new { Username = input.Username.Trim(), FullName = input.FullName.Trim(), Hash = hash,
                   Role = role, Email = input.Email?.Trim() });
    return Results.Created($"/api/users/{id}", new { id, message = "Pengguna berhasil ditambahkan." });
}).RequireAuthorization("Pic");
auth.MapPatch("/users/{id:int}", async Task<IResult> (int id, UserUpdateInput input, SqlConnection db, ClaimsPrincipal principal) =>
{
    if (string.IsNullOrWhiteSpace(input.FullName) || input.FullName.Length > 150 || input.Email?.Length > 180 ||
        (input.NewPassword is not null && (input.NewPassword.Length < 8 || input.NewPassword.Length > 128)))
        return Results.BadRequest(new { message = "Nama, email, atau password tidak valid." });
    if (id == Access.UserId(principal) && !input.IsActive)
        return Results.BadRequest(new { message = "Akun PIC sendiri tidak boleh dinonaktifkan." });
    await db.OpenAsync();
    var hash = input.NewPassword is null ? null : new PasswordHasher<UserRow>().HashPassword(new UserRow(), input.NewPassword);
    var affected = await db.ExecuteAsync("""
        UPDATE dbo.AppUsers SET FullName=@Name,Email=@Email,IsActive=@Active,
        PasswordHash=COALESCE(@Hash,PasswordHash) WHERE Id=@Id
        """, new { Id = id, Name = input.FullName.Trim(), Email = input.Email?.Trim(), Active = input.IsActive, Hash = hash });
    return affected == 0 ? Results.NotFound(new { message = "Pengguna tidak ditemukan." }) : Results.Ok(new { message = "Data pengguna diperbarui." });
}).RequireAuthorization("Pic");
auth.MapGet("/notifications", async Task<IResult> (ClaimsPrincipal principal, SqlConnection db) =>
{
    await db.OpenAsync();
    return Results.Ok(await db.QueryAsync("""
        SELECT TOP(50) Id AS id, DemoId AS demoId,Title AS title,Message AS message,
          IsRead AS isRead,CreatedAt AS createdAt
        FROM dbo.DemoNotifications WHERE UserId=@Id ORDER BY Id DESC
        """, new { Id = Access.UserId(principal) }));
});
auth.MapPost("/notifications/{id:int}/read", async Task<IResult> (int id, ClaimsPrincipal principal, SqlConnection db) =>
{
    await db.OpenAsync();
    var affected = await db.ExecuteAsync("UPDATE dbo.DemoNotifications SET IsRead=1 WHERE Id=@Id AND UserId=@UserId",
        new { Id = id, UserId = Access.UserId(principal) });
    return affected == 0 ? Results.NotFound() : Results.Ok(new { message = "Notifikasi dibaca." });
});

auth.MapGet("/period", async Task<IResult> (SqlConnection db) =>
{
    await db.OpenAsync();
    var period = await db.QuerySingleAsync("""
        SELECT IsOpen AS isOpen,StartAt AS startAt,EndAt AS endAt,RequirementsText AS requirementsText,UpdatedAt AS updatedAt
        FROM dbo.DemoPeriod WHERE Id=1
        """);
    return Results.Ok(period);
});
auth.MapPut("/period", async Task<IResult> (PeriodInput input, SqlConnection db) =>
{
    if (input.EndAt <= input.StartAt || input.RequirementsText?.Length > 1500)
        return Results.BadRequest(new { message = "Tanggal periode atau persyaratan tidak valid (maks. 1500 karakter)." });
    await db.OpenAsync();
    await db.ExecuteAsync("""
        UPDATE dbo.DemoPeriod SET IsOpen=@IsOpen,StartAt=@StartAt,EndAt=@EndAt,
          RequirementsText=@RequirementsText,UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=1
        """, input);
    return Results.Ok(new { message = "Periode pengajuan diperbarui." });
}).RequireAuthorization("Pic");

const string DemoSelect = """
  SELECT d.Id AS id, d.StudentId AS studentId, s.FullName AS studentName,
         d.LecturerId AS lecturerId, l.FullName AS lecturerName,
         d.Title AS title, d.Description AS description,
         d.ScheduledAt AS scheduledAt, d.DurationMinutes AS durationMinutes,
         d.Location AS location, d.RequiredDocuments AS requiredDocuments,
         d.Status AS status, d.ReviewNotes AS reviewNotes,
         d.LecturerReviewNotes AS lecturerReviewNotes, d.LecturerNotes AS lecturerNotes,
         d.LecturerScore AS lecturerScore, d.SubmissionNotes AS submissionNotes,
         d.CreatedAt AS createdAt, d.UpdatedAt AS updatedAt
  FROM dbo.DemoRequests d
  INNER JOIN dbo.AppUsers s ON s.Id=d.StudentId
  INNER JOIN dbo.AppUsers l ON l.Id=d.LecturerId
  """;

var demo = auth.MapGroup("/demos");
demo.MapGet("", async Task<IResult> (ClaimsPrincipal principal, SqlConnection db) =>
{
    await db.OpenAsync();
    var role = Access.Role(principal);
    var id = Access.UserId(principal);
    var where = role switch
    {
        "MAHASISWA" => " WHERE d.StudentId=@Id",
        "DOSEN" => " WHERE d.LecturerId=@Id AND d.Status IN ('PENDING_DOSEN','REVISION_DOSEN','READY_TO_SCHEDULE','SCHEDULED','DEMO_DONE','SUBMITTED','SUBMISSION_REVISION','COMPLETED')",
        _ => ""
    };
    return Results.Ok(await db.QueryAsync(DemoSelect + where + " ORDER BY d.CreatedAt DESC", new { Id = id }));
});
demo.MapGet("/{id:int}", async Task<IResult> (int id, ClaimsPrincipal principal, SqlConnection db) =>
{
    await db.OpenAsync();
    var row = await db.QuerySingleOrDefaultAsync(DemoSelect + " WHERE d.Id=@Id", new { Id = id });
    if (row is null) return Results.NotFound(new { message = "Pengajuan tidak ditemukan." });
    if (!await Access.CanSee(db, id, principal)) return Results.Forbid();
    return Results.Ok(row);
});
demo.MapPost("", async Task<IResult> (DemoInput input, ClaimsPrincipal principal, SqlConnection db) =>
{
    var validation = Access.Validate(input);
    if (validation is not null) return Results.BadRequest(new { message = validation });
    await db.OpenAsync();
    if (!await Access.IsPeriodOpen(db))
        return Results.Conflict(new { message = "Periode pengajuan belum dibuka atau sudah ditutup oleh PIC." });
    if (await Access.IsDuplicate(db, Access.UserId(principal), input.Title))
        return Results.Conflict(new { message = "Sudah ada pengajuan aktif dengan judul yang sama." });
    if (!await Access.IsLecturer(db, input.LecturerId))
        return Results.BadRequest(new { message = "Dosen pembimbing tidak valid." });
    using var tx = (SqlTransaction)await db.BeginTransactionAsync();
    var id = await db.QuerySingleAsync<int>("""
        INSERT INTO dbo.DemoRequests(StudentId,LecturerId,Title,Description,RequiredDocuments,Status)
        OUTPUT INSERTED.Id VALUES(@StudentId,@LecturerId,@Title,@Description,@RequiredDocuments,'PENDING_PIC')
        """, new {
            StudentId = Access.UserId(principal), input.LecturerId, Title = input.Title.Trim(),
            Description = input.Description?.Trim() ?? "", RequiredDocuments = input.RequiredDocuments.Trim()
        }, tx);
    await Access.History(db,tx,id,Access.UserId(principal),"PENGAJUAN_DIBUAT",null,"PENDING_PIC",null);
    await Access.NotifyPic(db,tx,id,"Pengajuan baru","Ada pengajuan demo yang perlu diperiksa kelengkapannya.");
    await tx.CommitAsync();
    return Results.Created($"/api/demos/{id}",new { id, message="Pengajuan berhasil dikirim ke PIC." });
}).RequireAuthorization("Mahasiswa");

demo.MapPut("/{id:int}", async Task<IResult> (int id, DemoInput input, ClaimsPrincipal principal, SqlConnection db) =>
{
    var validation = Access.Validate(input);
    if (validation is not null) return Results.BadRequest(new { message = validation });
    await db.OpenAsync();
    if (!await Access.IsLecturer(db, input.LecturerId))
        return Results.BadRequest(new { message = "Dosen pembimbing tidak valid." });
    using var tx = (SqlTransaction)await db.BeginTransactionAsync();
    var row = await Access.LockDemo(db,tx,id);
    if (row is null) return Results.NotFound(new { message="Pengajuan tidak ditemukan." });
    if (row.StudentId != Access.UserId(principal)) return Results.Forbid();
    if (row.Status is not ("REVISION_PIC" or "REVISION_DOSEN"))
        return Results.Conflict(new { message="Pengajuan belum berstatus perlu revisi." });
    await db.ExecuteAsync("""
        UPDATE dbo.DemoRequests SET Title=@Title, Description=@Description, LecturerId=@LecturerId,
        RequiredDocuments=@RequiredDocuments,Status='PENDING_PIC',ReviewNotes=NULL,
        LecturerReviewNotes=NULL,UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=@Id
        """,new { Id=id,Title=input.Title.Trim(),Description=input.Description?.Trim() ?? "",
              input.LecturerId,RequiredDocuments=input.RequiredDocuments.Trim() },tx);
    await Access.History(db,tx,id,Access.UserId(principal),"MAHASISWA_KIRIM_REVISI",row.Status,"PENDING_PIC",null);
    await Access.NotifyPic(db,tx,id,"Revisi pengajuan","Mahasiswa telah mengirim perbaikan untuk diperiksa ulang.");
    await tx.CommitAsync();
    return Results.Ok(new { message="Revisi berhasil dikirim kembali ke PIC." });
}).RequireAuthorization("Mahasiswa");

demo.MapPost("/{id:int}/review", async Task<IResult> (int id, ReviewInput input, ClaimsPrincipal principal, SqlConnection db) =>
{
    var choice=input.Decision?.Trim().ToUpperInvariant() ?? "";
    if (choice is not ("APPROVE" or "REVISE" or "REJECT") || input.Notes?.Length>1500 ||
       (choice != "APPROVE" && string.IsNullOrWhiteSpace(input.Notes)))
       return Results.BadRequest(new { message="Keputusan atau catatan pemeriksaan tidak valid." });
    await db.OpenAsync();
    using var tx=(SqlTransaction)await db.BeginTransactionAsync();
    var row=await Access.LockDemo(db,tx,id);
    if(row is null) return Results.NotFound(new { message="Pengajuan tidak ditemukan." });
    if(row.Status != "PENDING_PIC") return Results.Conflict(new { message="Pengajuan tidak sedang menunggu PIC." });
    if(choice=="APPROVE" && await db.ExecuteScalarAsync<int>(
        "SELECT COUNT(1) FROM dbo.DemoFiles WHERE DemoId=@Id AND FileKind='SUPPORTING'", new { Id=id },tx)==0)
        return Results.Conflict(new { message="Mahasiswa wajib mengunggah minimal satu dokumen pendukung sebelum diteruskan ke dosen." });
    var status=choice switch { "APPROVE"=>"PENDING_DOSEN", "REVISE"=>"REVISION_PIC", _=>"REJECTED" };
    await db.ExecuteAsync("""
        UPDATE dbo.DemoRequests SET Status=@Status, ReviewNotes=@Notes,
        UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=@Id
        """,new { Id=id,Status=status,Notes=input.Notes?.Trim() },tx);
    await Access.History(db,tx,id,Access.UserId(principal),"PIC_PERIKSA_"+choice,row.Status,status,input.Notes);
    if(choice == "APPROVE")
        await Access.Notify(db,tx,id,row.LecturerId,"Peninjauan aplikasi","Pengajuan mahasiswa telah lolos pemeriksaan PIC. Mohon tinjau aplikasi.");
    else
        await Access.Notify(db,tx,id,row.StudentId,"Keputusan pemeriksaan PIC",choice=="REVISE"?"Perbaiki dokumen pengajuan Anda.":"Pengajuan Anda ditolak.");
    await tx.CommitAsync();
    return Results.Ok(new { status,message="Pemeriksaan PIC berhasil disimpan." });
}).RequireAuthorization("Pic");

demo.MapPost("/{id:int}/lecturer-review", async Task<IResult> (int id, ReviewInput input, ClaimsPrincipal principal, SqlConnection db) =>
{
    var choice=input.Decision?.Trim().ToUpperInvariant() ?? "";
    if(choice is not ("APPROVE" or "REVISE") || input.Notes?.Length>1500 ||
       (choice=="REVISE" && string.IsNullOrWhiteSpace(input.Notes)))
       return Results.BadRequest(new { message="Keputusan dosen atau catatan revisi tidak valid." });
    await db.OpenAsync();
    using var tx=(SqlTransaction)await db.BeginTransactionAsync();
    var row=await Access.LockDemo(db,tx,id);
    if(row is null) return Results.NotFound(new { message="Pengajuan tidak ditemukan." });
    if(row.LecturerId != Access.UserId(principal)) return Results.Forbid();
    if(row.Status!="PENDING_DOSEN") return Results.Conflict(new { message="Pengajuan belum menunggu peninjauan dosen." });
    var status=choice=="APPROVE"?"READY_TO_SCHEDULE":"REVISION_DOSEN";
    await db.ExecuteAsync("""
        UPDATE dbo.DemoRequests SET Status=@Status,LecturerReviewNotes=@Notes,
        UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=@Id
        """,new { Id=id,Status=status,Notes=input.Notes?.Trim() },tx);
    await Access.History(db,tx,id,Access.UserId(principal),"DOSEN_TINJAU_"+choice,row.Status,status,input.Notes);
    if(choice=="APPROVE") await Access.NotifyPic(db,tx,id,"Siap dijadwalkan","Dosen menyetujui pengajuan. Silakan tetapkan jadwal final.");
    else await Access.Notify(db,tx,id,row.StudentId,"Revisi dari dosen","Dosen meminta perbaikan pengajuan sebelum penjadwalan.");
    await tx.CommitAsync();
    return Results.Ok(new { status,message="Peninjauan dosen disimpan." });
}).RequireAuthorization("Dosen");

demo.MapPost("/{id:int}/schedule", async Task<IResult> (int id, ScheduleInput input, ClaimsPrincipal principal, SqlConnection db) =>
{
    if(input.ScheduledAt<=DateTimeOffset.UtcNow || input.DurationMinutes is <15 or >240 ||
       string.IsNullOrWhiteSpace(input.Location) || input.Location.Length>150)
       return Results.BadRequest(new { message="Waktu harus di masa mendatang, durasi 15–240 menit, dan lokasi wajib diisi." });
    await db.OpenAsync();
    using var tx=(SqlTransaction)await db.BeginTransactionAsync(IsolationLevel.Serializable);
    var row=await Access.LockDemo(db,tx,id);
    if(row is null) return Results.NotFound(new { message="Pengajuan tidak ditemukan." });
    if(row.Status is not ("READY_TO_SCHEDULE" or "SCHEDULED"))
        return Results.Conflict(new { message="Jadwal hanya dapat ditetapkan setelah persetujuan dosen, atau diubah sebelum demo." });
    var overlap=await db.ExecuteScalarAsync<int>("""
        SELECT COUNT(1) FROM dbo.DemoRequests WITH(UPDLOCK,HOLDLOCK)
        WHERE Id<>@Id AND Status IN ('SCHEDULED','DEMO_DONE','SUBMITTED','SUBMISSION_REVISION','COMPLETED')
          AND ScheduledAt<@EndAt
          AND DATEADD(MINUTE,DurationMinutes,ScheduledAt)>@StartAt
          AND (LecturerId=@LecturerId OR LOWER(LTRIM(RTRIM(Location)))=LOWER(LTRIM(RTRIM(@Location))))
        """,new { Id=id,StartAt=input.ScheduledAt,EndAt=input.ScheduledAt.AddMinutes(input.DurationMinutes),
                 row.LecturerId,Location=input.Location.Trim() },tx);
    if(overlap>0) return Results.Conflict(new { message="Bentrok waktu dengan jadwal dosen atau ruangan lain." });
    await db.ExecuteAsync("""
        UPDATE dbo.DemoRequests SET ScheduledAt=@ScheduledAt,DurationMinutes=@DurationMinutes,
        Location=@Location,Status='SCHEDULED',UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=@Id
        """,new { Id=id,input.ScheduledAt,input.DurationMinutes,Location=input.Location.Trim() },tx);
    var notice=$"Demo {input.ScheduledAt.ToOffset(TimeSpan.FromHours(7)):dd MMM yyyy HH:mm} WIB di {input.Location.Trim()}.";
    await Access.History(db,tx,id,Access.UserId(principal),row.Status=="SCHEDULED"?"PIC_UBAH_JADWAL":"PIC_TETAPKAN_JADWAL",row.Status,"SCHEDULED",notice);
    await Access.Notify(db,tx,id,row.StudentId,"Jadwal demo diperbarui",notice);
    await Access.Notify(db,tx,id,row.LecturerId,"Jadwal demo diperbarui",notice);
    await tx.CommitAsync();
    return Results.Ok(new { message="Jadwal demo berhasil ditetapkan dan notifikasi dikirim." });
}).RequireAuthorization("Pic");

demo.MapPost("/{id:int}/reassign-lecturer", async Task<IResult> (int id, ReassignLecturerInput input,
    ClaimsPrincipal principal, SqlConnection db) =>
{
    await db.OpenAsync();
    if(!await Access.IsLecturer(db,input.LecturerId)) return Results.BadRequest(new { message="Dosen tidak valid." });
    using var tx=(SqlTransaction)await db.BeginTransactionAsync();
    var row=await Access.LockDemo(db,tx,id);
    if(row is null) return Results.NotFound(new { message="Pengajuan tidak ditemukan." });
    if(row.Status is not ("PENDING_DOSEN" or "READY_TO_SCHEDULE" or "SCHEDULED"))
       return Results.Conflict(new { message="Dosen hanya dapat diganti sebelum pelaksanaan demo." });
    if(row.LecturerId==input.LecturerId) return Results.BadRequest(new { message="Pilih dosen pembimbing yang berbeda." });
    await db.ExecuteAsync("""
        UPDATE dbo.DemoRequests SET LecturerId=@LecturerId,Status='PENDING_DOSEN',
        ScheduledAt=NULL,DurationMinutes=NULL,Location=NULL,LecturerReviewNotes=NULL,
        UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=@Id
        """, new { Id=id, input.LecturerId }, tx);
    await Access.History(db,tx,id,Access.UserId(principal),"PIC_GANTI_DOSEN",row.Status,"PENDING_DOSEN",input.Notes);
    await Access.Notify(db,tx,id,input.LecturerId,"Peninjauan dari PIC","Anda ditunjuk sebagai dosen pembimbing. Mohon lakukan peninjauan.");
    await Access.Notify(db,tx,id,row.StudentId,"Dosen pembimbing berubah","PIC mengganti dosen pembimbing. Peninjauan perlu dilakukan kembali.");
    await tx.CommitAsync();
    return Results.Ok(new { message="Dosen berhasil diganti dan alur kembali ke peninjauan." });
}).RequireAuthorization("Pic");

demo.MapPost("/{id:int}/complete-demo", async Task<IResult> (int id, EvaluationInput input, ClaimsPrincipal principal, SqlConnection db) =>
{
    if(input.Score is <0 or >100 || string.IsNullOrWhiteSpace(input.Notes) || input.Notes.Length>1500)
      return Results.BadRequest(new { message="Nilai 0–100 dan catatan evaluasi (maks. 1500 karakter) wajib diisi." });
    await db.OpenAsync();
    using var tx=(SqlTransaction)await db.BeginTransactionAsync();
    var row=await Access.LockDemo(db,tx,id);
    if(row is null) return Results.NotFound(new { message="Pengajuan tidak ditemukan." });
    if(row.LecturerId!=Access.UserId(principal)) return Results.Forbid();
    if(row.Status!="SCHEDULED") return Results.Conflict(new { message="Hanya demo terjadwal yang dapat dievaluasi." });
    if(row.ScheduledAt is null || row.ScheduledAt> DateTimeOffset.UtcNow)
        return Results.Conflict(new { message="Evaluasi baru bisa dicatat pada atau setelah waktu demo terjadwal." });
    await db.ExecuteAsync("""
        UPDATE dbo.DemoRequests SET Status='DEMO_DONE',LecturerScore=@Score,
        LecturerNotes=@Notes,UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=@Id
        """,new { Id=id,input.Score,Notes=input.Notes.Trim() },tx);
    await Access.History(db,tx,id,Access.UserId(principal),"DOSEN_EVALUASI_DEMO",row.Status,"DEMO_DONE",$"Nilai: {input.Score}. {input.Notes.Trim()}");
    await Access.Notify(db,tx,id,row.StudentId,"Hasil evaluasi tersedia","Dosen telah mencatat hasil demo. Silakan unggah berkas aplikasi akhir.");
    await Access.NotifyPic(db,tx,id,"Demo selesai","Dosen telah memberikan nilai dan evaluasi demo.");
    await tx.CommitAsync();
    return Results.Ok(new { message="Nilai dan evaluasi demo tersimpan." });
}).RequireAuthorization("Dosen");

demo.MapPost("/{id:int}/submission-review", async Task<IResult> (int id, SubmissionReviewInput input, ClaimsPrincipal principal, SqlConnection db) =>
{
    var choice = input.Decision?.Trim().ToUpperInvariant() ?? "";
    if (input.Notes?.Length > 1500)
        return Results.BadRequest(new { message = "Catatan maksimal 1.500 karakter." });
    if (choice is not ("APPROVE" or "REVISE"))
        return Results.BadRequest(new { message = "Keputusan harus APPROVE atau REVISE." });
    if (choice == "REVISE" && string.IsNullOrWhiteSpace(input.Notes))
        return Results.BadRequest(new { message = "Alasan revisi tugas wajib diisi." });
    await db.OpenAsync();
    using var tx = (SqlTransaction)await db.BeginTransactionAsync();
    var row = await Access.LockDemo(db, tx, id);
    if (row is null) return Results.NotFound(new { message = "Pengajuan tidak ditemukan." });
    if (row.Status != "SUBMITTED")
        return Results.Conflict(new { message = "Belum ada tugas yang menunggu validasi PIC." });
    var status = choice == "APPROVE" ? "COMPLETED" : "SUBMISSION_REVISION";
    await db.ExecuteAsync("""
        UPDATE dbo.DemoRequests SET Status=@Status,SubmissionNotes=@Notes,UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=@Id
        """, new { Id = id, Status = status, Notes = input.Notes?.Trim() }, tx);
    await Access.History(db, tx, id, Access.UserId(principal), "PIC_TUGAS_" + choice, row.Status, status, input.Notes);
    await Access.Notify(db,tx,id,row.StudentId,choice=="APPROVE"?"Pengajuan selesai":"Revisi tugas akhir",
        choice=="APPROVE"?"Berkas aplikasi Anda sudah diverifikasi PIC.":"PIC meminta Anda memperbaiki berkas akhir.");
    await tx.CommitAsync();
    return Results.Ok(new { message = "Validasi tugas berhasil disimpan.", status });
}).RequireAuthorization("Pic");

demo.MapGet("/{id:int}/history", async Task<IResult> (int id, ClaimsPrincipal principal, SqlConnection db) =>
{
    await db.OpenAsync();
    if (!await Access.CanSee(db, id, principal)) return Results.Forbid();
    var items = await db.QueryAsync("""
        SELECT h.Id AS id,h.ActionName AS actionName,h.FromStatus AS fromStatus,h.ToStatus AS toStatus,
               h.Notes AS notes,h.CreatedAt AS createdAt,u.FullName AS actorName
        FROM dbo.DemoHistory h JOIN dbo.AppUsers u ON u.Id=h.ActorId
        WHERE h.DemoId=@Id ORDER BY h.Id DESC
        """, new { Id = id });
    return Results.Ok(items);
});

demo.MapGet("/{id:int}/files", async Task<IResult> (int id, ClaimsPrincipal principal, SqlConnection db) =>
{
    await db.OpenAsync();
    if (!await Access.CanSee(db, id, principal)) return Results.Forbid();
    return Results.Ok(await db.QueryAsync("""
        SELECT f.Id AS id,f.DemoId AS demoId,f.FileKind AS fileKind,
          f.OriginalName AS originalName,f.FileSize AS fileSize,f.CreatedAt AS createdAt,
          u.FullName AS uploadedByName
        FROM dbo.DemoFiles f JOIN dbo.AppUsers u ON u.Id=f.UploadedBy
        WHERE f.DemoId=@Id ORDER BY f.Id DESC
        """, new { Id = id }));
});

demo.MapPost("/{id:int}/files", async Task<IResult> (int id, HttpRequest request,
    ClaimsPrincipal principal, SqlConnection db, IWebHostEnvironment env) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest(new { message = "Gunakan multipart/form-data (file dan kind)." });
    var form = await request.ReadFormAsync();
    var file = form.Files.GetFile("file");
    var kind = form["kind"].ToString().ToUpperInvariant();
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { message = "File wajib dipilih." });
    if (kind is not ("SUPPORTING" or "SUBMISSION"))
        return Results.BadRequest(new { message = "Jenis file harus SUPPORTING atau SUBMISSION." });
    var limit = kind == "SUPPORTING" ? 10L * 1024 * 1024 : 30L * 1024 * 1024;
    if (file.Length > limit) return Results.BadRequest(new { message = $"Ukuran file maksimal {limit / (1024 * 1024)} MB." });
    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    var allowed = kind == "SUPPORTING" ? new[] { ".pdf", ".docx", ".zip" } : new[] { ".zip", ".pdf", ".docx" };
    if (!allowed.Contains(extension)) return Results.BadRequest(new { message = "Ekstensi diperbolehkan: PDF, DOCX, ZIP." });
    await using (var stream = file.OpenReadStream())
    {
        var header = new byte[4];
        if (await stream.ReadAsync(header) < 4 || !Access.ValidHeader(header, extension))
            return Results.BadRequest(new { message = "Format isi file tidak cocok dengan ekstensi." });
    }
    await db.OpenAsync();
    using var tx = (SqlTransaction)await db.BeginTransactionAsync();
    var row = await Access.LockDemo(db, tx, id);
    if (row is null) return Results.NotFound(new { message = "Pengajuan tidak ditemukan." });
    if (row.StudentId != Access.UserId(principal)) return Results.Forbid();
    if (kind == "SUPPORTING" && row.Status is not ("PENDING_PIC" or "REVISION_PIC" or "REVISION_DOSEN"))
        return Results.Conflict(new { message = "Dokumen pendukung hanya dapat diunggah sebelum pengajuan disetujui." });
    if (kind == "SUBMISSION" && row.Status is not ("DEMO_DONE" or "SUBMISSION_REVISION"))
        return Results.Conflict(new { message = "Pengumpulan tugas baru tersedia setelah dosen mengonfirmasi demo." });
    var contentType = extension switch { ".pdf" => "application/pdf", ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document", _ => "application/zip" };
    var original = Path.GetFileName(file.FileName);
    if (original.Length > 255) original = original[^255..];
    var stored = Guid.NewGuid().ToString("N") + extension;
    var uploadRoot = Path.Combine(env.ContentRootPath, "PrivateUploads");
    Directory.CreateDirectory(uploadRoot);
    var fullPath = Path.Combine(uploadRoot, stored);
    try
    {
        await using (var target = File.Create(fullPath))
            await file.CopyToAsync(target);
        var fileId = await db.QuerySingleAsync<int>("""
            INSERT INTO dbo.DemoFiles(DemoId,UploadedBy,FileKind,OriginalName,StoredName,ContentType,FileSize)
            OUTPUT INSERTED.Id VALUES (@DemoId,@UserId,@FileKind,@OriginalName,@StoredName,@ContentType,@FileSize)
            """, new { DemoId = id, UserId = Access.UserId(principal), FileKind = kind,
                OriginalName = original, StoredName = stored, ContentType = contentType, FileSize = file.Length }, tx);
        var nextStatus = kind == "SUBMISSION" ? "SUBMITTED" : row.Status;
        if (kind == "SUBMISSION")
            await db.ExecuteAsync("UPDATE dbo.DemoRequests SET Status='SUBMITTED',SubmissionNotes=NULL,UpdatedAt=SYSDATETIMEOFFSET() WHERE Id=@Id", new { Id = id }, tx);
        await Access.History(db, tx, id, Access.UserId(principal), kind == "SUBMISSION" ? "MAHASISWA_KIRIM_TUGAS" : "UNGGAH_DOKUMEN",
            row.Status, nextStatus, original);
        if(kind=="SUBMISSION") await Access.NotifyPic(db,tx,id,"Tugas akhir baru","Mahasiswa telah mengunggah tugas akhir untuk diperiksa.");
        await tx.CommitAsync();
        return Results.Ok(new { id = fileId, message = kind == "SUBMISSION" ? "Tugas berhasil dikirim ke PIC." : "Dokumen pendukung berhasil diunggah." });
    }
    catch
    {
        if (File.Exists(fullPath)) File.Delete(fullPath);
        throw;
    }
}).RequireAuthorization("Mahasiswa").DisableAntiforgery();

auth.MapGet("/files/{id:int}/download", async Task<IResult> (int id, ClaimsPrincipal principal,
    SqlConnection db, IWebHostEnvironment env) =>
{
    await db.OpenAsync();
    var row = await db.QuerySingleOrDefaultAsync<FileRow>("""
        SELECT Id,DemoId,OriginalName,StoredName,ContentType FROM dbo.DemoFiles WHERE Id=@Id
        """, new { Id = id });
    if (row is null) return Results.NotFound(new { message = "File tidak ditemukan." });
    if (!await Access.CanSee(db, row.DemoId, principal)) return Results.Forbid();
    var full = Path.Combine(env.ContentRootPath, "PrivateUploads", row.StoredName);
    if (!File.Exists(full)) return Results.NotFound(new { message = "File fisik tidak ditemukan." });
    return Results.File(full, row.ContentType, row.OriginalName);
});

if (app.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Seed:DemoAccounts"))
{
    using var scope = app.Services.CreateScope();
    await SeedDemoUsers(scope.ServiceProvider.GetRequiredService<SqlConnection>());
}
app.Run();

static async Task SeedDemoUsers(SqlConnection db)
{
    await db.OpenAsync();
    var seed = new[]
    {
        ("mahasiswa1", "Adi Pratama", "MAHASISWA"),
        ("mahasiswa2", "Budi Santoso", "MAHASISWA"),
        ("dosen1", "Dr. Budi Santoso", "DOSEN"),
        ("dosen2", "Dr. Ratna Putri", "DOSEN"),
        ("pic1", "PIC Akademik", "PIC")
    };
    foreach (var (username, fullName, role) in seed)
    {
        var exists = await db.QuerySingleAsync<int>("SELECT COUNT(1) FROM dbo.AppUsers WHERE Username=@Username", new { Username = username });
        if (exists != 0) continue;
        var passwordHash = new PasswordHasher<UserRow>().HashPassword(new UserRow(), "Demo123!");
        await db.ExecuteAsync("""
            INSERT INTO dbo.AppUsers(Username,FullName,PasswordHash,RoleName)
            VALUES (@Username,@FullName,@PasswordHash,@RoleName)
            """, new { Username = username, FullName = fullName, PasswordHash = passwordHash, RoleName = role });
    }
}
